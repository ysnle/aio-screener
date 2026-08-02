// Wave 5 blocking route soak: three ordered laps over the 17 native routes.
// This is intentionally a local deterministic gate. It does not certify live
// provider SLOs or a deployed Pages revision.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ROUTE_SOAK_PORT || 8903);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const ROUTES = ['home', 'signal', 'breadth', 'sentiment', 'briefing', 'technical', 'macro', 'fxbond', 'themes', 'theme-detail', 'ticker', 'fundamental', 'options', 'portfolio', 'market-news', 'screener', 'principles', 'masters', 'atlas', 'guide'];
const canonical = (route) => route === 'theme-detail' ? 'themes' : route;
const isExpectedOfflineConsole = (message) => /net::ERR_FAILED/.test(message)
  || /^\[AIO:api\]\s+[\w-]+:\s+warn\s+.*error/.test(message);

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[route-soak/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
const report = { ok: true, routes: ROUTES.length, laps: 3, lapReports: [], errors: [], entityRoundTrip: null };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  page.on('pageerror', (error) => report.errors.push(`pageerror:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !isExpectedOfflineConsole(message.text())) report.errors.push(`console:${message.text()}`);
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.navigate === 'function', { timeout: 30000 });

  for (let lap = 1; lap <= 3; lap += 1) {
    const lapRows = [];
    for (const route of ROUTES) {
      const target = canonical(route);
      await page.evaluate((id) => window.AIO_ARCH.navigate(id), route);
      await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioArchitectureRoute === id, target, { timeout: 15000 });
      if (route === 'theme-detail') await page.waitForFunction(() => document.getElementById('theme-detail-panel')?.style.display !== 'none', { timeout: 10000 });
      await page.waitForTimeout(60);
      const row = await page.evaluate(({ routeId, targetId }) => {
        const visiblePages = [...document.querySelectorAll('.page')].filter((node) => getComputedStyle(node).display !== 'none');
        const node = document.getElementById(`page-${targetId}`);
        const scope = window.AIO_ARCH.router.activeScope?.();
        return {
          route: routeId,
          active: window.AIO_ARCH.router.active(),
          visiblePages: visiblePages.map((page) => page.id),
          marker: node?.dataset.aioVerticalSlice || null,
          state: node?.dataset.aioVerticalSliceState || null,
          charts: Object.keys(window._aioChartRegistry?._charts || {}).length,
          canvases: document.querySelectorAll('canvas').length,
          entityId: scope?.entityId || null
        };
      }, { routeId: route, targetId: target });
      if (row.active !== target || row.visiblePages.length !== 1 || row.visiblePages[0] !== `page-${target}` || !row.marker || !row.state) {
        throw new Error(`route soak surface failed lap=${lap}: ${JSON.stringify(row)}`);
      }
      lapRows.push(row);
    }
    report.lapReports.push({ lap, last: lapRows[lapRows.length - 1], maxCharts: Math.max(...lapRows.map((row) => row.charts)), maxCanvases: Math.max(...lapRows.map((row) => row.canvases)) });
  }

  const entityRoundTrip = await page.evaluate(async () => {
    const sequence = [];
    for (const entityId of ['AAPL', 'MSFT', 'AAPL']) {
      window.AIO_ARCH.router.transition('ticker', { entityId, source: 'route-soak' });
      await new Promise((resolve) => setTimeout(resolve, 80));
      sequence.push({ entityId: window.AIO_ARCH.router.activeScope?.()?.entityId || null, mountId: window.AIO_ARCH.router.activeScope?.()?.mountId || null });
    }
    return { sequence, active: window.AIO_ARCH.router.active() };
  });
  report.entityRoundTrip = entityRoundTrip;
  if (JSON.stringify(entityRoundTrip.sequence.map((row) => row.entityId)) !== JSON.stringify(['AAPL', 'MSFT', 'AAPL']) || entityRoundTrip.active !== 'ticker') throw new Error(`entity A→B→A failed: ${JSON.stringify(entityRoundTrip)}`);
  const first = report.lapReports[0];
  const last = report.lapReports[report.lapReports.length - 1];
  if (first.maxCharts !== last.maxCharts || first.maxCanvases !== last.maxCanvases) throw new Error(`chart/canvas count grew across soak: ${JSON.stringify({ first, last })}`);
} catch (error) {
  report.ok = false;
  report.errors.push(String(error?.stack || error));
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(resolve(root, '_artifacts/route-soak-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok || report.errors.length) process.exitCode = 1;
