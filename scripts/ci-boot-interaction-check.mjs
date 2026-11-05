import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { DESKTOP_PRIMARY_VIEWPORT } from './desktop-qa-config.mjs';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';
import { stagePagesCode, CLASSIC_BOOT_SCRIPTS } from './lib/pages-bundle-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = (Number(process.env.CI_BOOT_PORT) || await freePort());
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const BOOT_OBSERVATION_WINDOW_MS = 2000;
// The window the evidence reports bytes and requests for (a user's first ~6.5 s); see the wait below.
const MEASURE_WINDOW_MS = 6500;
const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const indexSource = readFileSync(resolve(root, 'index.html'), 'utf8');
const operationsSlo = JSON.parse(readFileSync(resolve(root, 'architecture', 'operations-slo.json'), 'utf8'));
const bootBudget = JSON.parse(readFileSync(resolve(root, 'architecture', 'boot-budget.json'), 'utf8'));

// v59.70 (2nd batch A, P0): measure the deployed bundle, not the source tree. Served unbundled, the page fetched 556
// modules one by one and the resource-timing buffer (250 entries) filled at 248, so the reported 3.85 MB was cut short;
// the deploy ships minified classic scripts and hashed chunks instead. The staged copy is built exactly as
// .github/workflows/pages-deploy.yml builds it (scripts/lib/pages-bundle-config.mjs) and served with this repository's
// public-data. AIO_BOOT_SOURCE=1 measures the source tree instead (diagnosis only).
const measureSource = process.env.AIO_BOOT_SOURCE === '1';
const stageDir = measureSource ? null : mkdtempSync(join(tmpdir(), 'aio-boot-stage-'));
let chunkInputs = {};
let bootModules = [];
if (stageDir) {
  const pages = stagePagesCode(root, join(stageDir, 'pages'));
  const built = spawnSync(process.execPath, ['scripts/build-pages-bundle.mjs', pages, '--manifest', join(stageDir, 'manifest.json'), '--inputs', join(stageDir, 'inputs.json')], { cwd: root, encoding: 'utf8' });
  if (built.status !== 0) throw new Error(`build-pages-bundle failed: ${built.stderr || built.stdout}`);
  chunkInputs = JSON.parse(readFileSync(join(stageDir, 'inputs.json'), 'utf8'));
  bootModules = JSON.parse(readFileSync(join(stageDir, 'manifest.json'), 'utf8')).bootModules;
}
// Shipped files that belong to the AI panel: they must not load before a user reaches an AI control (owner D1).
const AI_PANEL_INPUTS = ['src/domain/research/supplied-materials.js', 'src/app/chat-globals.js', 'src/ui/components/ai-profile.js', 'src/ai/intent/question-cues.js'];
const aiPanelFiles = new Set(['js/aio-chat.js', ...Object.entries(chunkInputs).filter(([, inputs]) => inputs.some((input) => AI_PANEL_INPUTS.includes(input))).map(([file]) => file)]);
const pathOf = (url) => { try { return new URL(url).pathname.replace(/^\//, ''); } catch { return ''; } };
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
const server = await startLocalServer(port, { label: 'boot-interaction/server', env: stageDir ? { AIO_SERVE_ROOT: join(stageDir, 'pages') } : {} });
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
    // The boot a user gets: automated browsers otherwise load the AI panel at once (src/app/chat-loader.js).
    window.__aioUserBoot = true;
    performance.setResourceTimingBufferSize(2000);
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
  await page.waitForTimeout(MEASURE_WINDOW_MS);
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
        return {
          decodedJsBytes: local.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0), sameOriginScripts: local.length, crossOriginScripts: scripts.length - local.length,
          resourceEntries: performance.getEntriesByType('resource').length,
          scriptFiles: local.map((entry) => ({ url: entry.name, bytes: entry.decodedBodySize || 0, startMs: Math.round(entry.startTime) }))
        };
      })()
    };
  }, BOOT_OBSERVATION_WINDOW_MS);
  // Where the bytes went: the ESM boot set, the classic boot scripts, the AI panel files and everything else (lazy).
  const files = result.scriptFiles.map((entry) => ({ ...entry, path: pathOf(entry.url) }));
  delete result.scriptFiles;
  const sum = (list) => list.reduce((total, entry) => total + entry.bytes, 0);
  const bootSet = new Set(bootModules);
  const classicSet = new Set(CLASSIC_BOOT_SCRIPTS);
  const aiFiles = files.filter((entry) => aiPanelFiles.has(entry.path));
  const lazyFiles = files.filter((entry) => !bootSet.has(entry.path) && !classicSet.has(entry.path) && !aiPanelFiles.has(entry.path));
  result.jsByKind = {
    esmBoot: sum(files.filter((entry) => bootSet.has(entry.path))),
    classicBoot: sum(files.filter((entry) => classicSet.has(entry.path))),
    aiPanelBeforeUse: sum(aiFiles),
    postBootLazy: sum(lazyFiles)
  };
  result.aiPanelRequestsBeforeUse = aiFiles.map((entry) => entry.path);
  result.largestLazyFiles = lazyFiles.sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(({ path, bytes, startMs }) => ({ path, bytes, startMs }));
  result.measuredBundle = measureSource ? 'source' : 'deploy';
  // Then a user reaches the AI button: the panel script and the corpus start loading on hover, before the click.
  if (!measureSource) {
    const seen = new Set(files.map((entry) => entry.path));
    await page.hover('#topbar-ai-btn');
    await page.waitForFunction(() => typeof window.chatSendUnified === 'function' && !/queue\.push/.test(String(window.chatSendUnified)), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const afterHover = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
    result.aiPanelOnHover = [...new Set(afterHover.map(pathOf).filter((file) => aiPanelFiles.has(file) && !seen.has(file)))].sort();
  }
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
  if (!measureSource) {
    // v59.70 (owner D1): the AI panel script and reference corpus wait for an AI control; hovering it starts both.
    if (result.aiPanelRequestsBeforeUse.length) failures.push(`AI panel files fetched before any AI control was reached: ${result.aiPanelRequestsBeforeUse.join(', ')}`);
    const corpusChunk = Object.entries(chunkInputs).find(([, inputs]) => inputs.includes('src/domain/research/supplied-materials.js'))?.[0];
    for (const needed of ['js/aio-chat.js', corpusChunk].filter(Boolean)) if (!result.aiPanelOnHover.includes(needed)) failures.push(`hovering the AI button did not start ${needed}`);
    const lazyBudget = bootBudget.postBootLazyBudget?.rawBytes;
    if (!(lazyBudget > 0)) failures.push('architecture/boot-budget.json has no postBootLazyBudget.rawBytes');
    else if (result.jsByKind.postBootLazy > lazyBudget) failures.push(`post-boot lazy JS ${result.jsByKind.postBootLazy} bytes in ${MEASURE_WINDOW_MS} ms > budget ${lazyBudget} (${result.largestLazyFiles.map((entry) => `${entry.path} ${entry.bytes}`).join(', ')})`);
    if (result.resourceEntries >= 2000) failures.push(`resource timing buffer full (${result.resourceEntries}); the byte count is cut short`);
  }
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
  if (stageDir) rmSync(stageDir, { recursive: true, force: true });
}
