import { chromium } from 'playwright';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = (Number(process.env.AIO_SA02_PORT) || await freePort());
const baseUrl = `http://127.0.0.1:${port}/index.html`;

async function runOnce(browser, run) {
  const page = await browser.newPage();
  const external = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(`http://127.0.0.1:${port}/`)) external.push(request.url());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.showPage === 'function', { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('live-quote-ts')?.textContent?.includes('서버 '), { timeout: 30000 });
  // The first outage fallback request is intentionally asynchronous. Sample
  // after the initial retry window so the fixture compares stable fallback
  // state rather than racing the first fail-count increment.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2600));
  // Chromium scheduling can delay the rejected fetch callback beyond the
  // nominal retry window. Wait for the deterministic failure counter when it
  // is available, while keeping a bounded timeout for a fully blocked boot.
  await page.waitForFunction(() => Number(window.__aioQuoteDemand?.state().failures || 0) >= 1, { timeout: 10000 }).catch(() => {});
  const early = await page.evaluate(() => {
    const sources = Object.values(window._dataSource || {});
    return {
      snapshotSources: sources.filter((entry) => String(entry?.source || '').includes('snapshot')).length,
      topbar: {
        text: document.getElementById('live-quote-ts')?.textContent || '',
        className: document.getElementById('live-quote-ts')?.dataset?.currentness || '',
        title: document.getElementById('live-quote-ts')?.getAttribute('title') || ''
      },
      quoteFailCount: window.__aioQuoteDemand ? window.__aioQuoteDemand.state().failures : null
    };
  });
  const earlyQuoteRequests = external.filter((url) => /yahoo|stooq|quote|corsproxy|allorigins|codetabs/i.test(url)).length;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2200));
  const lateQuoteRequests = external.filter((url) => /yahoo|stooq|quote|corsproxy|allorigins|codetabs/i.test(url)).length;
  const late = await page.evaluate(() => ({
    quoteFailCount: window.__aioQuoteDemand ? window.__aioQuoteDemand.state().failures : null,
    topbar: document.getElementById('live-quote-ts')?.textContent || ''
  }));
  await page.close();
  // P1326/R671: a server snapshot is labelled 종가/지난 시세 (never live) with the snapshot named in the title.
  const topbarOk = /^서버 /.test(early.topbar.text) && /^(close|stale)$/.test(early.topbar.className)
    && /서버 기준 스냅샷/.test(early.topbar.title);
  const topbarStructuralOk = early.topbar.text.length > 0 && /^(close|stale)$/.test(early.topbar.className) && early.topbar.title.length > 0;
  const ok = early.snapshotSources >= 16
    && early.snapshotSources >= 16
     && topbarStructuralOk
    && late.quoteFailCount === early.quoteFailCount;
  return { run, ok, early, late, earlyQuoteRequests, lateQuoteRequests };
}

// v59.70 (ui-states): history.json and data.json refused. Before, both loaders returned null without a word and every
// close-based card said '불러오는 중' for good; now the shell shows one failure line with 다시 시도, the basis lines say
// the record did not arrive, and a retry that succeeds removes the line.
async function runCoreFileFailure(browser) {
  const page = await browser.newPage();
  let refuse = true;
  // v59.70: the screener read waits on the critical-data gate; a failed history/data read now settles it at once,
  // where it used to hold that read for the gate's 20 s fallback. Timed from navigation.
  let screenerRequestedAt = null;
  let navigatedAt = Date.now();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) return route.abort();
    if (screenerRequestedAt == null && /\/public-data\/screener\.json/.test(url)) screenerRequestedAt = Date.now() - navigatedAt;
    if (refuse && /\/public-data\/(history|data)\.json/.test(url)) return route.abort('failed');
    return route.continue();
  });
  navigatedAt = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.showPage === 'function', { timeout: 30000 });
  const notice = await page.waitForSelector('#aio-load-failure .aio-state__retry', { timeout: 20000 }).then(() => true).catch(() => false);
  for (let waited = 0; screenerRequestedAt == null && waited < 12000; waited += 250) await page.waitForTimeout(250);
  const screenerReadPrompt = screenerRequestedAt != null && screenerRequestedAt < 12000;
  const failed = await page.evaluate(() => ({
    line: document.querySelector('#aio-load-failure .aio-state__text')?.textContent || '',
    hero: document.getElementById('home-hero-headline')?.textContent?.trim() || '',
    regime: document.getElementById('regime-basis')?.textContent?.trim() || '',
  }));
  refuse = false;
  await page.click('#aio-load-failure .aio-state__retry');
  const cleared = await page.waitForFunction(() => !document.getElementById('aio-load-failure'), { timeout: 20000 }).then(() => true).catch(() => false);
  await page.close();
  const ok = notice && /받지 못했습니다/.test(failed.line) && failed.hero !== '종가 기록을 불러오는 중입니다.' && failed.regime === '종가 기록을 받지 못했습니다.' && cleared && screenerReadPrompt;
  return { run: 'core-file-failure', ok, notice, failed, cleared, screenerRequestedAt, screenerReadPrompt };
}

// v59.70 (ui-states): an empty answer (history.json [] and data.json {}) is the empty state, not an error and not 불러오는 중.
async function runCoreFileEmpty(browser) {
  const page = await browser.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) return route.abort();
    if (/\/public-data\/history\.json/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/\/public-data\/data\.json/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.continue();
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const shown = await page.waitForSelector('#aio-load-failure.is-empty', { timeout: 20000 }).then(() => true).catch(() => false);
  const empty = await page.evaluate(() => ({
    line: document.querySelector('#aio-load-failure .aio-state__text')?.textContent || '',
    retry: !!document.querySelector('#aio-load-failure .aio-state__retry'),
    regime: document.getElementById('regime-basis')?.textContent?.trim() || '',
  }));
  await page.close();
  const ok = shown && /비어 있습니다/.test(empty.line) && !empty.retry && empty.regime === '종가 기록이 없습니다.';
  return { run: 'core-file-empty', ok, shown, empty };
}

const server = await startLocalServer(port, { label: 'sa02/server' });
let browser;
try {
  browser = await chromium.launch();
  const results = [await runOnce(browser, 1), await runOnce(browser, 2), await runCoreFileFailure(browser), await runCoreFileEmpty(browser)];
  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({ ok, fixture: 'SA-02 outage-browser-fixture', runs: results }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await closeAll({ browser, server });
}
