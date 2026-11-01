import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { DESKTOP_PRIMARY_VIEWPORT } from './desktop-qa-config.mjs';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_BOOT_PORT || 8898);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const BOOT_OBSERVATION_WINDOW_MS = 2000;
const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const indexSource = readFileSync(resolve(root, 'index.html'), 'utf8');
const operationsSlo = JSON.parse(readFileSync(resolve(root, 'architecture', 'operations-slo.json'), 'utf8'));
const git = (args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { return null; } };

// P1756: the chart library loads on first chart use. A boot requests nothing; the first ensure('lwc') requests
// lightweight-charts once, a second call reuses it, and any other name resolves null without a request (v59.55: Chart.js
// left with its last screen, so no Chart.js URL is ever requested).
async function verifyOnDemandChartLibrary(browserInstance) {
  const coordinator = indexSource.match(/<script>\s*\/\/ Chart library loads on demand \(P1756\)([\s\S]*?)<\/script>/)?.[1];
  if (!coordinator) return { passed: false, reason: 'chart coordinator source missing' };
  const fixture = await browserInstance.newPage();
  let lwcRequests = 0;
  let chartJsRequests = 0;
  try {
    await fixture.route('**/*', async (route) => {
      const url = route.request().url();
      if (/chart\.js|Chart\.js|chart\.umd/.test(url)) chartJsRequests++;
      if (url.includes('lightweight-charts@4.2.0')) {
        lwcRequests++;
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.LightweightCharts={createChart:function(){return {};}};' });
      }
      return route.abort();
    });
    // The fixture body is not the pinned file, so the SRI check is dropped (the real hash is pinned by ci-runtime-contract-check).
    await fixture.setContent(`<script>// Chart library loads on demand (P1756)${coordinator.replace(/, integrity: '[^']*'/, '').replace(/script\.integrity = LWC_SOURCE\.integrity; /, '')}</script>`, { waitUntil: 'domcontentloaded' });
    await fixture.waitForTimeout(300);
    const bootRequests = lwcRequests + chartJsRequests;
    const state = await fixture.evaluate(async () => {
      const first = await window._aioEnsureChartLibrary('lwc');
      const second = await window._aioEnsureChartLibrary('lwc');
      const other = await window._aioEnsureChartLibrary('chart');
      return { loaded: typeof first?.createChart === 'function', reused: first === second, other: other === null, noChartGlobal: typeof window.Chart === 'undefined' };
    });
    return {
      passed: bootRequests === 0 && lwcRequests === 1 && chartJsRequests === 0 && state.loaded && state.reused && state.other && state.noChartGlobal,
      bootRequests, lwcRequests, chartJsRequests, ...state
    };
  } finally {
    await fixture.close();
  }
}

// v57.62: shared lifecycle — resolves only on the server ready line; the server is closed even if launch throws.
const server = await startLocalServer(port, { label: 'boot-interaction/server' });
let browser;
let evidence = null;
try {
  browser = await chromium.launch();
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
      bootStatusPresent: !!document.getElementById('aio-boot-status'),
      // Codex audit F14 (2026-10-15): decodedJsMbMax had no measurement. Same-origin scripts (classic + native ESM)
      // fetched by the end of the observation window, decoded bytes; cross-origin CDN libraries report 0 decoded bytes
      // without Timing-Allow-Origin, so they are counted separately and not added to the budget figure.
      ...(() => {
        const scripts = performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'script' || /\.m?js(?:[?#]|$)/.test(entry.name));
        const local = scripts.filter((entry) => entry.name.startsWith(location.origin));
        return { decodedJsBytes: local.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0), sameOriginScripts: local.length, crossOriginScripts: scripts.length - local.length };
      })()
    };
  }, BOOT_OBSERVATION_WINDOW_MS);
  result.routeMs = routeMs;
  result.wallMs = Date.now() - wallStart;
  result.totalExternalRequests = externalRequests.length;
  result.quoteRequests = quoteRequests.length;
  result.initialExternalRequests = initialExternalRequests.length;
  result.initialQuoteRequests = initialQuoteRequests.length;
  result.bootObservationWindowMs = BOOT_OBSERVATION_WINDOW_MS;
  result.onDemandChartLibrary = await verifyOnDemandChartLibrary(browser);
  const failures = [];
  if (result.fcpMs == null || result.fcpMs > 2500) failures.push(`FCP ${result.fcpMs}ms > 2500ms`);
  if (result.routeMs > 2000) failures.push(`initial route ${result.routeMs}ms > 2000ms`);
  if (result.maxLongTaskMs > 2500) failures.push(`max long task ${result.maxLongTaskMs}ms > 2500ms`);
  if (result.activePage !== 'page-signal') failures.push(`route did not activate signal (${result.activePage})`);
  if (result.bootStatusPresent) failures.push('boot status did not hard-release');
  if (!result.onDemandChartLibrary.passed) failures.push(`P1756 on-demand chart library: boot fetched a chart library, lightweight-charts was not loaded once, or a Chart.js URL was requested (${JSON.stringify(result.onDemandChartLibrary)})`);
  const targets = operationsSlo.targets?.bootPerformance || {};
  const targetFailures = [];
  if (result.initialExternalRequests > targets.initialExternalRequestsMax) targetFailures.push(`initial external ${result.initialExternalRequests} > ${targets.initialExternalRequestsMax}`);
  if (result.initialQuoteRequests > targets.initialQuoteRequestsMax) targetFailures.push(`initial quotes ${result.initialQuoteRequests} > ${targets.initialQuoteRequestsMax}`);
  if (result.activeRouteDomNodes > targets.domNodesMax) targetFailures.push(`active DOM ${result.activeRouteDomNodes} > ${targets.domNodesMax}`);
  if (result.domNodes > targets.totalDomNodesDiagnosticMax) targetFailures.push(`total DOM ${result.domNodes} > ${targets.totalDomNodesDiagnosticMax}`);
  if (result.maxLongTaskMs > targets.maxLongTaskMs) targetFailures.push(`max long task ${result.maxLongTaskMs} > ${targets.maxLongTaskMs}`);
  if (result.totalLongTaskMs > targets.totalLongTaskMs) targetFailures.push(`total long task ${result.totalLongTaskMs} > ${targets.totalLongTaskMs}`);
  result.decodedJsMb = Math.round(result.decodedJsBytes / 10485.76) / 100;
  if (Number.isFinite(targets.decodedJsMbMax) && result.decodedJsMb > targets.decodedJsMbMax) targetFailures.push(`decoded same-origin JS ${result.decodedJsMb}MB > ${targets.decodedJsMbMax}MB`);
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
    // Codex audit F13 (2026-10-15): the operations-slo targets are a reported goal, not a blocking gate; qa-runner
    // prints a TARGET_MISS line beside the PASS so a green run is never read as "performance target met" (R701).
    targetPolicy: 'report-not-blocking',
    targetFailures,
    metrics: result
  };
  writeFileSync(resolve(root, '_artifacts', 'boot-interaction-report.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (targetFailures.length) console.error(`[boot] TARGET_MISS (reported, not blocking): ${targetFailures.join('; ')}`);
  if (failures.length) throw new Error(`boot interaction gate failed: ${failures.join('; ')}`);
} finally {
  await closeAll({ browser, server });
}
