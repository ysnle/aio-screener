// v57.81: browser gate for the screener's 종목 범위 control. The extended shard is route-stubbed with a small shard built by
// the producer's own payload builder from real core rows (renamed symbols), so the check needs no network. On PC and
// phone widths it proves: the default view never requests the shard; 확장 requests it once and merges its rows; the
// rank labels name the extended contract; search, the index filter, sort, compare and the ticker link work on shard
// rows; the validation tabs say they stay core-only; the choice survives a reload; 기본 restores the core rows.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { buildExtendedShardPayload } from './fetch-data.mjs';
import { expandScreenerArtifact } from '../src/data/screener-extended.js'; // v57.95 core row encoding

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SCREENER_EXTENDED_TEST_PORT || 8957);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const json = (rel) => JSON.parse(readFileSync(resolve(root, rel), 'utf8'));
const core = expandScreenerArtifact(json('public-data/screener.json'));
const universe = json('public-data/screener-universe.json').universe || [];

// A small shard from real US core rows under new symbols: the same row schema the producer writes.
const source = universe.filter((row) => core.data[row.sym] && !/\.(KS|KQ|T|TW|TWO)$/.test(row.sym) && row.index !== 'ETF' && row.sector !== 'ETF').slice(0, 40);
const stubSymbol = (index) => `ZXQ${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + Math.floor(index / 26))}`;
const data = {};
const identityRows = source.map((row, index) => {
  const sym = stubSymbol(index);
  const factor = { ...core.data[row.sym] };
  ['newsMemo', 'newsTs', 'newsObservedAt', 'newsFetchedAt', 'newsMemoVerified', 'newsMemoSources'].forEach((key) => delete factor[key]);
  factor.newsStatus = 'not-covered';
  data[sym] = factor;
  return { sym, name: `Extended Fixture ${index}`, sector: row.sector || null, index: index % 2 ? 'NASDAQ' : 'RUSSELL2000', membership: index % 2 ? ['NASDAQ'] : ['RUSSELL2000', 'NASDAQ'], exchange: 'NASDAQ' };
});
const shard = buildExtendedShardPayload({
  data, syms: identityRows.map((row) => row.sym), identityRows,
  membership: { generatedAt: core.asOf, meta: { sources: { r2000: { status: 'CURRENT', asOf: core.asOf.slice(0, 10) }, nasdaq: { status: 'CURRENT', asOf: core.asOf.slice(0, 10) } } }, coreMembership: { AAPL: ['NASDAQ'], NVDA: ['NASDAQ'] } },
  secResult: { ok: 0, stored: 0, eligible: 0, model: 'sec-fy-normalized-v2', generatedAt: null }, computedAt: core.factorComputedAt, ok: identityRows.length, nowIso: core.asOf
});
const shardBody = JSON.stringify(shard);
const coreRowCount = new Set([...universe.map((row) => row.sym), ...Object.keys(core.data)]).size;
const fixtureEpoch = Date.parse(core.asOf) + 3600000;

const server = await startLocalServer(port, { label: 'screener-extended/server' });
let browser;
const failures = [];
const fail = (viewport, message) => failures.push(`[${viewport}] ${message}`);
try {
  browser = await chromium.launch();
  for (const viewport of [{ id: 'pc', width: 1440, height: 1000 }, { id: 'phone', width: 375, height: 812, isMobile: true, hasTouch: true }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(fixtureEpoch));
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    let shardRequests = 0;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (/\/public-data\/screener-extended\.json(?:\?|$)/.test(url)) {
        shardRequests += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', body: shardBody });
      }
      return url.startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort();
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800, { timeout: 45000 });
    await page.evaluate(() => window.showPage('screener'));
    await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length > 0 && document.getElementById('scr-universe-scope'), { timeout: 30000 });
    if (shardRequests !== 0) fail(viewport.id, `default view requested the extended shard ${shardRequests} time(s)`);
    const defaultState = await page.evaluate(() => ({ scope: document.getElementById('scr-universe-scope').value, label: document.getElementById('scr-universe-scope').options[0].textContent, rows: window.AIO_ARCH.getScreenerState().rows.length }));
    if (defaultState.scope !== 'core' || !/^기본 \(\d+종목\)$/.test(defaultState.label) || defaultState.rows !== coreRowCount) fail(viewport.id, `default scope/label/rows wrong: ${JSON.stringify(defaultState)}`);

    // 확장
    await page.selectOption('#scr-universe-scope', 'extended');
    await page.waitForFunction((count) => window.AIO_ARCH.getScreenerState()?.metadata?.universeScope === 'extended' && window.AIO_ARCH.getScreenerState().rows.length === count, coreRowCount + identityRows.length, { timeout: 30000 });
    await page.waitForFunction(() => /확장 유니버스 기준/.test(document.getElementById('scr-population-note')?.textContent || ''), { timeout: 15000 });
    const extended = await page.evaluate(() => {
      const state = window.AIO_ARCH.getScreenerState();
      const extendedRows = state.rows.filter((row) => row.universeTier === 'extended');
      return {
        requested: state.metadata.requestedUniverseScope,
        contract: state.metadata.ranking?.contract,
        extendedRows: extendedRows.length,
        rankedExtended: extendedRows.filter((row) => Number.isFinite(row.rank)).length,
        allLabelled: state.rows.every((row) => row.rankingUniverse === 'extended'),
        option: document.getElementById('scr-universe-scope').options[1].textContent,
        status: document.getElementById('scr-universe-status')?.textContent || '',
        storage: localStorage.getItem('aio_screener_universe_scope') || sessionStorage.getItem('aio_screener_universe_scope'),
        rankTitles: [...document.querySelectorAll('#screener-results-body [data-ranking-contract]')].map((node) => node.dataset.rankingContract)
      };
    });
    if (shardRequests !== 1) fail(viewport.id, `확장 should request the shard once, got ${shardRequests}`);
    if (extended.contract !== 'extended-universe' || !extended.allLabelled || extended.extendedRows !== identityRows.length || extended.rankedExtended < identityRows.length / 2) fail(viewport.id, `extended merge/ranking wrong: ${JSON.stringify(extended)}`);
    if (!extended.option.includes(`(+${identityRows.length})`) || !/확장 \d+종목 포함/.test(extended.status) || extended.storage !== 'extended') fail(viewport.id, `extended label/status/storage wrong: ${JSON.stringify(extended)}`);
    if (extended.rankTitles.length && extended.rankTitles.some((id) => id !== 'extended-universe')) fail(viewport.id, `rank cells not labelled with the extended contract: ${extended.rankTitles.join(',')}`);

    // Search finds a shard row.
    // v57.83: the stub copies a real core row, so whether it passes the default preset (rank 60+, 통과 종목만) depends on the
    // day's data (2026-10-16: rank 54). The search, compare and row-open steps test a shard row, so the pass filter is off while they run.
    const target = identityRows[0].sym;
    const setPassedOnly = (on) => page.evaluate((value) => { const box = document.getElementById('scr-passed-only'); if (box && box.checked !== value) { box.checked = value; box.dispatchEvent(new Event('change', { bubbles: true })); } }, on);
    const passedOnly = await page.evaluate(() => document.getElementById('scr-passed-only')?.checked === true);
    if (passedOnly) await setPassedOnly(false);
    await page.fill('#scr-text-search', target);
    await page.waitForFunction((sym) => [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')].some((node) => node.dataset.aioScreenerTicker === sym), target, { timeout: 10000 });
    await page.fill('#scr-text-search', '');
    // Index filter: 러셀2000 keeps only rows that carry the tag (membership or index).
    const hasRussellOption = await page.evaluate(() => [...document.getElementById('scr-market').options].some((option) => option.value === 'RUSSELL2000'));
    if (!hasRussellOption) fail(viewport.id, 'index filter has no 러셀2000 option in the extended view');
    else {
      await page.selectOption('#scr-market', 'RUSSELL2000');
      await page.waitForTimeout(300);
      const russell = await page.evaluate(() => {
        const rows = new Map(window.AIO_ARCH.getScreenerState().rows.map((row) => [row.sym, row]));
        const visible = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')].map((node) => node.dataset.aioScreenerTicker);
        return { visible: visible.length, ok: visible.every((sym) => rows.get(sym)?.index === 'RUSSELL2000' || (rows.get(sym)?.membership || []).includes('RUSSELL2000')) };
      });
      if (!russell.visible || !russell.ok) fail(viewport.id, `러셀2000 filter wrong: ${JSON.stringify(russell)}`);
      await page.selectOption('#scr-market', '');
    }
    // Sort by 3-month return over the merged population.
    await page.selectOption('#scr-order', 'ret3m');
    await page.waitForTimeout(300);
    const sorted = await page.evaluate(() => {
      const rows = new Map(window.AIO_ARCH.getScreenerState().rows.map((row) => [row.sym, row]));
      const values = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')].map((node) => rows.get(node.dataset.aioScreenerTicker)?.ret3m).filter(Number.isFinite);
      return values.every((value, index) => index === 0 || values[index - 1] >= value) && values.length > 1;
    });
    if (!sorted) fail(viewport.id, '3개월 수익률 sort is not descending in the extended view');
    // Compare and the ticker link on a shard row.
    await page.fill('#scr-text-search', target);
    // Wait for the debounced search render (one row left) so the click lands on the settled table.
    await page.waitForFunction((sym) => { const rows = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')]; return rows.length === 1 && rows[0].dataset.aioScreenerTicker === sym && !!document.querySelector(`[data-aio-screener-compare="${sym}"]`); }, target, { timeout: 10000 });
    // The settled table stays put: the visible-row quote request (and its retries) must not rebuild the rows
    // (the extended view used to rebuild the table every few hundred ms and detach the button under the click).
    const idleRebuilds = await page.evaluate(() => new Promise((resolve) => {
      let removed = 0;
      const observer = new MutationObserver((list) => { removed += list.filter((entry) => entry.removedNodes.length).length; });
      observer.observe(document.getElementById('screener-results-body'), { childList: true });
      setTimeout(() => { observer.disconnect(); resolve(removed); }, 2500);
    }));
    if (idleRebuilds) fail(viewport.id, `settled table rebuilt ${idleRebuilds} time(s) with no input`);
    await page.locator(`[data-aio-screener-compare="${target}"]`).first().click();
    await page.waitForFunction((sym) => !document.getElementById('scr-compare-tray')?.hidden && (document.getElementById('scr-compare-list')?.textContent || '').includes(sym), target, { timeout: 10000 });
    // Core-only line in the validation tab.
    const coreOnly = await page.evaluate(() => { const note = document.querySelector('#scr-tab-backtest > .scr-core-only-note'); return note && !note.hidden ? note.textContent : ''; });
    if (!/기본 유니버스\(\d+종목\)만 다룹니다/.test(coreOnly)) fail(viewport.id, `core-only note missing: ${coreOnly}`);
    // Phone width: no horizontal page scroll with the new control.
    if (viewport.id === 'phone') {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) fail(viewport.id, `horizontal scroll ${overflow}px at 375`);
    }
    await page.locator(`#screener-results-body [data-aio-screener-ticker="${target}"]`).first().click({ position: { x: 4, y: 4 } });
    await page.waitForFunction(() => document.getElementById('scr-why-drawer') && !document.getElementById('scr-why-drawer').hidden, { timeout: 10000 });
    await page.locator('#scr-why-drawer [data-aio-screener-action="open-ticker"]').first().click();
    await page.waitForFunction((sym) => (document.getElementById('ticker-page-title')?.textContent || '').includes(sym) || String(location.hash).includes(sym), target, { timeout: 15000 });
    const tickerRow = await page.evaluate((sym) => {
      const rows = typeof window._aioGetCanonicalScreenerRows === 'function' ? window._aioGetCanonicalScreenerRows() : window.AIO_ARCH.getScreenerRows();
      const row = rows.find((item) => item.sym === sym);
      return row ? { tier: row.universeTier, contract: row.rankingUniverse, ret3m: row.ret3m } : null;
    }, target);
    if (!tickerRow || tickerRow.tier !== 'extended' || tickerRow.contract !== 'extended') fail(viewport.id, `ticker page does not read the shard row: ${JSON.stringify(tickerRow)}`);
    if (passedOnly) await setPassedOnly(true);

    // Reload: the choice is remembered; the shard is fetched again only once the screener shows.
    shardRequests = 0;
    // A hash-only goto stays in the same document, so reload to prove the choice survives a fresh boot.
    await page.goto(`${baseUrl}#screener`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.showPage === 'function', { timeout: 30000 });
    await page.evaluate(() => window.showPage('screener'));
    await page.waitForFunction(() => document.getElementById('scr-universe-scope')?.value === 'extended' && window.AIO_ARCH?.getScreenerState?.()?.metadata?.universeScope === 'extended', { timeout: 45000 });
    if (shardRequests < 1) fail(viewport.id, 'remembered 확장 did not load the shard on the screener');
    // 기본 restores the core population.
    await page.selectOption('#scr-universe-scope', 'core');
    await page.waitForFunction((count) => window.AIO_ARCH.getScreenerState()?.metadata?.universeScope === 'core' && window.AIO_ARCH.getScreenerState().rows.length === count, coreRowCount, { timeout: 30000 });
    const restored = await page.evaluate(() => ({ labelled: window.AIO_ARCH.getScreenerState().rows.some((row) => 'rankingUniverse' in row || 'universeTier' in row), contract: window.AIO_ARCH.getScreenerState().metadata.ranking?.contract, note: document.querySelector('#scr-tab-backtest > .scr-core-only-note')?.hidden !== false }));
    if (restored.labelled || restored.contract !== 'core-universe' || !restored.note) fail(viewport.id, `기본 did not restore the core view: ${JSON.stringify(restored)}`);
    const relevantErrors = runtimeErrors.filter((message) => !/net::ERR_FAILED|Failed to fetch|NetworkError|aborted/i.test(message));
    if (relevantErrors.length) fail(viewport.id, `runtime errors: ${relevantErrors.slice(0, 3).join(' | ')}`);
    await context.close();
  }
} finally {
  await closeAll({ browser, server });
}
if (failures.length) {
  console.error(`Screener extended browser check FAIL (${failures.length}):\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`Screener extended browser check PASS (pc + phone; shard ${identityRows.length} rows, ${Buffer.byteLength(shardBody).toLocaleString('en-US')} bytes)`);
