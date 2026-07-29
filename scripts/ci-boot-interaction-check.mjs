import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_BOOT_PORT || 8898);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const BOOT_OBSERVATION_WINDOW_MS = 2000;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let done = false;
    const ready = () => { if (!done) { done = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) ready(); });
    child.on('error', reject);
    child.on('exit', (code) => { if (!done) reject(new Error(`server exited early (${code})`)); });
    setTimeout(ready, 1500);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const externalRequests = [];
  const quoteRequests = [];
  const initialExternalRequests = [];
  const initialQuoteRequests = [];
  const requestStart = Date.now();
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(`http://127.0.0.1:${port}/`)) return;
    externalRequests.push(url);
    const isQuote = /finance\/chart|stooq|finance\.naver|stock\.naver|polling\.finance\.naver|fchart/i.test(url);
    if (isQuote) quoteRequests.push(url);
    if (Date.now() - requestStart <= BOOT_OBSERVATION_WINDOW_MS) {
      initialExternalRequests.push(url);
      if (isQuote) initialQuoteRequests.push(url);
    }
  });
  await page.addInitScript(() => {
    window.__aioBootLongTasks = [];
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => window.__aioBootLongTasks.push({ start: entry.startTime, duration: entry.duration }));
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
    return route.abort();
  });
  const wallStart = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const interactiveStart = Date.now();
  await page.evaluate(() => window.showPage('signal'));
  const routeMs = Date.now() - interactiveStart;
  await page.waitForTimeout(6500);
  const result = await page.evaluate((bootWindowMs) => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const tasks = (window.__aioBootLongTasks || []).filter((task) => task.start <= bootWindowMs);
    return {
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      dclMs: Math.round(nav.domContentLoadedEventEnd || 0),
      loadMs: Math.round(nav.loadEventEnd || 0),
      maxLongTaskMs: Math.round(Math.max(0, ...tasks.map((task) => task.duration))),
      totalLongTaskMs: Math.round(tasks.reduce((sum, task) => sum + task.duration, 0)),
      longTaskCount: tasks.length,
      longTaskObservationWindowMs: bootWindowMs,
      domNodes: document.getElementsByTagName('*').length,
      activeRouteDomNodes: document.querySelector('.page.active')?.getElementsByTagName('*').length || 0,
      activePage: document.querySelector('.page.active')?.id || '',
      bootStatusPresent: !!document.getElementById('aio-boot-status')
    };
  }, BOOT_OBSERVATION_WINDOW_MS);
  result.routeMs = routeMs;
  result.wallMs = Date.now() - wallStart;
  result.totalExternalRequests = externalRequests.length;
  result.quoteRequests = quoteRequests.length;
  result.initialExternalRequests = initialExternalRequests.length;
  result.initialQuoteRequests = initialQuoteRequests.length;
  result.bootObservationWindowMs = BOOT_OBSERVATION_WINDOW_MS;
  console.log(JSON.stringify(result, null, 2));
  const failures = [];
  if (result.fcpMs == null || result.fcpMs > 2500) failures.push(`FCP ${result.fcpMs}ms > 2500ms`);
  if (result.routeMs > 2000) failures.push(`initial route ${result.routeMs}ms > 2000ms`);
  if (result.maxLongTaskMs > 2500) failures.push(`max long task ${result.maxLongTaskMs}ms > 2500ms`);
  if (result.activePage !== 'page-signal') failures.push(`route did not activate signal (${result.activePage})`);
  if (result.bootStatusPresent) failures.push('boot status did not hard-release');
  if (failures.length) throw new Error(`boot interaction gate failed: ${failures.join('; ')}`);
} finally {
  await browser.close();
  server.kill();
}
