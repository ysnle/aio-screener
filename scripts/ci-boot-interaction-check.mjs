import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { DESKTOP_PRIMARY_VIEWPORT } from './desktop-qa-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_BOOT_PORT || 8898);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const BOOT_OBSERVATION_WINDOW_MS = 2000;
const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const indexSource = readFileSync(resolve(root, 'index.html'), 'utf8');
const operationsSlo = JSON.parse(readFileSync(resolve(root, 'architecture', 'operations-slo.json'), 'utf8'));
const git = (args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { return null; } };

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

// P1756: Chart.js loads on first chart use. A boot requests nothing; the first `new Chart()` requests the primary, a
// slow primary (2 s) still wins without a secondary request or the local fallback, the pending chart is built on the
// real constructor, defaults written early are replayed, and the #aio-chart-cdn element receives its load event.
async function verifyDelayedPrimaryChart(browserInstance) {
  const coordinator = indexSource.match(/<script>\s*\/\/ Chart libraries load on demand \(P1756\)\.([\s\S]*?)<\/script>/)?.[1];
  // The fixture body is not the pinned file, so its SRI attribute is dropped (the real hash is pinned by ci-runtime-contract-check).
  const placeholder = indexSource.match(/<script id="aio-chart-cdn"[^>]*><\/script>/)?.[0]?.replace(/ data-aio-integrity="[^"]*"/, '');
  if (!coordinator || !placeholder) return { passed: false, reason: 'chart coordinator source missing' };
  const fixture = await browserInstance.newPage();
  let primaryRequests = 0;
  let secondaryRequests = 0;
  let lwcRequests = 0;
  try {
    await fixture.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')) {
        primaryRequests++;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=function DelayedPrimaryChart(item,config){this.item=item;this.config=config;};window.Chart.defaults={font:{},plugins:{tooltip:{}}};' });
      }
      if (url.includes('cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js')) secondaryRequests++;
      if (url.includes('lightweight-charts')) lwcRequests++;
      return route.abort();
    });
    // Fake page timers (time still flows) so the coordinator's 5000 ms secondary-CDN timer can be
    // fast-forwarded instead of slept through. A timer that was not cleared still fires here.
    await fixture.clock.install();
    await fixture.setContent(`${placeholder}<script>// Chart libraries load on demand (P1756).${coordinator}</script>`, { waitUntil: 'domcontentloaded' });
    await fixture.waitForTimeout(300);
    const bootRequests = primaryRequests + secondaryRequests + lwcRequests;
    await fixture.evaluate(() => {
      window.__placeholderLoads = 0;
      document.getElementById('aio-chart-cdn').addEventListener('load', () => { window.__placeholderLoads++; });
      window.__Deferred = window.Chart;
      window.Chart.defaults.color = '#123456';
      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      window.__deferred = new window.Chart(canvas, { type: 'line', data: { labels: [], datasets: [] } });
    });
    await fixture.waitForFunction(() => window.Chart?.name === 'DelayedPrimaryChart', null, { timeout: 8000, polling: 50 }).catch(() => {});
    await fixture.clock.runFor(5200);
    await fixture.waitForTimeout(100);
    const state = await fixture.evaluate(() => ({
      chartName: window.Chart?.name || '',
      localFallback: !!window.Chart?.__aioFallback,
      built: !!(window.__deferred && window.__deferred._real instanceof window.Chart),
      defaultsReplayed: window.Chart?.defaults?.color === '#123456',
      placeholderLoads: window.__placeholderLoads,
      direct: new window.__Deferred(document.createElement('canvas'), {}) instanceof window.Chart
    }));
    return {
      passed: bootRequests === 0 && primaryRequests === 1 && secondaryRequests === 0 && lwcRequests === 0
        && state.chartName === 'DelayedPrimaryChart' && state.localFallback === false && state.built
        && state.defaultsReplayed && state.placeholderLoads === 1 && state.direct,
      bootRequests, primaryRequests, secondaryRequests, lwcRequests,
      ...state
    };
  } finally {
    await fixture.close();
  }
}

const server = await startServer();
const browser = await chromium.launch();
let evidence = null;
try {
  const page = await browser.newPage({ viewport: DESKTOP_PRIMARY_VIEWPORT });
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
  // Measure the shell's first paint before injecting the synthetic route change.
  // Calling showPage() in the same task as DOMContentLoaded can prevent Chromium
  // from presenting the already-parsed shell and incorrectly charge the route's
  // synchronous work to FCP. FCP and route latency have independent release
  // budgets below, so force a real presentation opportunity between them.
  await page.evaluate(() => new Promise((resolvePaint) => {
    requestAnimationFrame(() => requestAnimationFrame(resolvePaint));
  }));
  const interactiveStart = Date.now();
  await page.evaluate(() => window.showPage('signal'));
  const routeMs = Date.now() - interactiveStart;
  // Deliberate post-boot observation window, not a settle guess: it spans the coordinator's 5000 ms
  // Chart.js fallback timer and the deferred fetches counted in totalExternalRequests/quoteRequests,
  // so the evidence reports what a user's first ~6.5 s actually requested (long tasks use the 2 s window).
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
  result.delayedPrimaryChart = await verifyDelayedPrimaryChart(browser);
  const failures = [];
  if (result.fcpMs == null || result.fcpMs > 2500) failures.push(`FCP ${result.fcpMs}ms > 2500ms`);
  if (result.routeMs > 2000) failures.push(`initial route ${result.routeMs}ms > 2000ms`);
  if (result.maxLongTaskMs > 2500) failures.push(`max long task ${result.maxLongTaskMs}ms > 2500ms`);
  if (result.activePage !== 'page-signal') failures.push(`route did not activate signal (${result.activePage})`);
  if (result.bootStatusPresent) failures.push('boot status did not hard-release');
  if (!result.delayedPrimaryChart.passed) failures.push(`P1756 on-demand Chart.js: boot fetched a chart library, or a delayed primary triggered a false fallback (${JSON.stringify(result.delayedPrimaryChart)})`);
  const targets = operationsSlo.targets?.bootPerformance || {};
  const targetFailures = [];
  if (result.initialExternalRequests > targets.initialExternalRequestsMax) targetFailures.push(`initial external ${result.initialExternalRequests} > ${targets.initialExternalRequestsMax}`);
  if (result.initialQuoteRequests > targets.initialQuoteRequestsMax) targetFailures.push(`initial quotes ${result.initialQuoteRequests} > ${targets.initialQuoteRequestsMax}`);
  if (result.activeRouteDomNodes > targets.domNodesMax) targetFailures.push(`active DOM ${result.activeRouteDomNodes} > ${targets.domNodesMax}`);
  if (result.domNodes > targets.totalDomNodesDiagnosticMax) targetFailures.push(`total DOM ${result.domNodes} > ${targets.totalDomNodesDiagnosticMax}`);
  if (result.maxLongTaskMs > targets.maxLongTaskMs) targetFailures.push(`max long task ${result.maxLongTaskMs} > ${targets.maxLongTaskMs}`);
  if (result.totalLongTaskMs > targets.totalLongTaskMs) targetFailures.push(`total long task ${result.totalLongTaskMs} > ${targets.totalLongTaskMs}`);
  const statusLines = git(['status', '--short']) || '';
  evidence = {
    schemaVersion: 'aio-boot-performance-evidence.v1',
    observedAt: new Date().toISOString(),
    appRevision: version,
    gitHead: git(['rev-parse', 'HEAD']),
    gitClean: statusLines.length === 0,
    environment: { browser: 'chromium', browserVersion: browser.version(), platform: process.platform, node: process.version, viewport: `${DESKTOP_PRIMARY_VIEWPORT.width}x${DESKTOP_PRIMARY_VIEWPORT.height}` },
    command: 'node scripts/ci-boot-interaction-check.mjs',
    gateStatus: failures.length ? 'FAIL' : 'PASS',
    targetStatus: targetFailures.length ? 'TARGET_MISS' : 'TARGET_COMPLIANT',
    targetFailures,
    metrics: result
  };
  writeFileSync(resolve(root, '_artifacts', 'boot-interaction-report.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (failures.length) throw new Error(`boot interaction gate failed: ${failures.join('; ')}`);
} finally {
  await browser.close();
  server.kill();
}
