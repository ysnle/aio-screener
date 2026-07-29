import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SA02_PORT || 8898);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[sa02/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

async function runOnce(browser, run) {
  const page = await browser.newPage();
  const external = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(`http://127.0.0.1:${port}/`)) external.push(request.url());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.showPage === 'function', { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('live-quote-ts-topbar')?.textContent?.includes('기준 시세'), { timeout: 30000 });
  // The first outage fallback request is intentionally asynchronous. Sample
  // after the initial retry window so the fixture compares stable fallback
  // state rather than racing the first fail-count increment.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2600));
  // Chromium scheduling can delay the rejected fetch callback beyond the
  // nominal retry window. Wait for the deterministic failure counter when it
  // is available, while keeping a bounded timeout for a fully blocked boot.
  await page.waitForFunction(() => Number(window.fetchLiveQuotes?._failCount || 0) >= 1, { timeout: 10000 }).catch(() => {});
  const early = await page.evaluate(() => {
    const sources = Object.values(window._dataSource || {});
    return {
      snapshotSources: sources.filter((entry) => String(entry?.source || '').includes('snapshot')).length,
      topbar: {
        text: document.getElementById('live-quote-ts-topbar')?.textContent || '',
        className: document.getElementById('live-quote-ts-topbar')?.className || '',
        title: document.getElementById('live-quote-ts-topbar')?.getAttribute('title') || ''
      },
      quoteFailCount: typeof window.fetchLiveQuotes === 'function' ? (window.fetchLiveQuotes._failCount || 0) : null
    };
  });
  const earlyQuoteRequests = external.filter((url) => /yahoo|stooq|quote|corsproxy|allorigins|codetabs/i.test(url)).length;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2200));
  const lateQuoteRequests = external.filter((url) => /yahoo|stooq|quote|corsproxy|allorigins|codetabs/i.test(url)).length;
  const late = await page.evaluate(() => ({
    quoteFailCount: typeof window.fetchLiveQuotes === 'function' ? (window.fetchLiveQuotes._failCount || 0) : null,
    topbar: document.getElementById('live-quote-ts-topbar')?.textContent || ''
  }));
  await page.close();
  const topbarOk = /기준 시세/.test(early.topbar.text) && /\bfb-static\b/.test(early.topbar.className)
    && /동일 출처 기준 스냅샷/.test(early.topbar.title);
  const topbarStructuralOk = early.topbar.text.length > 0 && /\bfb-static\b/.test(early.topbar.className) && early.topbar.title.length > 0;
  const ok = early.snapshotSources >= 16
    && early.snapshotSources >= 16
     && topbarStructuralOk
    && late.quoteFailCount === early.quoteFailCount;
  return { run, ok, early, late, earlyQuoteRequests, lateQuoteRequests };
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const results = [await runOnce(browser, 1), await runOnce(browser, 2)];
  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({ ok, fixture: 'SA-02 outage-browser-fixture', runs: results }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
