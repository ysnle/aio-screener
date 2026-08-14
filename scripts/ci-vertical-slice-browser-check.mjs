// Wave 3 boundary gate: visit each planned vertical slice under blocked
// external network, assert the canonical page contract/state, then re-enter the
// route to prove the slice marker and lifecycle survive a leave/re-enter.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { VERTICAL_SLICE_CONTRACTS } from '../src/app/vertical-slices.js';
import { DESKTOP_PRIMARY_VIEWPORT, DESKTOP_QA_SCOPE } from './desktop-qa-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_VERTICAL_SLICE_PORT || 8902);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[vertical-slice/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
const report = { ok: true, scope: DESKTOP_QA_SCOPE, viewport: DESKTOP_PRIMARY_VIEWPORT, slices: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: DESKTOP_PRIMARY_VIEWPORT });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.navigate === 'function', { timeout: 30000 });
  for (const slice of VERTICAL_SLICE_CONTRACTS) {
    const routeResults = [];
    for (const route of slice.routes) {
      const canonicalRoute = route === 'theme-detail' ? 'themes' : route;
      await page.evaluate((id) => window.AIO_ARCH.navigate(id), route);
      await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioArchitectureRoute === id, canonicalRoute);
      if (route === 'theme-detail') await page.waitForFunction(() => document.getElementById('theme-detail-panel')?.style.display !== 'none', { timeout: 10000 });
      const first = await page.evaluate(({ routeId, canonical, sliceId, requiredData, sliceRoutes }) => {
        const node = document.getElementById(`page-${canonical}`);
        const contracts = sliceRoutes.map((id) => window.AIO.getPageContract(id)).filter(Boolean);
        const completeness = window.AIO.getPageDataCompleteness(routeId);
        const producerNames = new Set(contracts.flatMap((contract) => [...(contract.requiredProducers || []), ...(contract.optionalProducers || [])]));
        const controls = [...(node?.querySelectorAll('button,[data-action],input,select,textarea') || [])].filter((element) => !element.disabled && element.offsetParent !== null);
        return {
          route: routeId,
          marker: node?.dataset.aioVerticalSlice || null,
          state: node?.dataset.aioVerticalSliceState || null,
          validState: ['loaded', 'partial', 'blocked', 'empty', 'stale-reference'].includes(completeness?.status),
          requiredDataMapped: requiredData.every((producer) => producerNames.has(producer)),
          controls: controls.length,
          directEntrySurface: !!node,
          completeness: completeness?.status || null
        };
      }, { routeId: route, canonical: canonicalRoute, sliceId: slice.id, requiredData: slice.requiredData, sliceRoutes: slice.routes });
      if (first.marker !== slice.id || first.state === null || !first.validState || !first.requiredDataMapped || !first.directEntrySurface) throw new Error(`slice route contract failed: ${JSON.stringify({ slice: slice.id, result: first })}`);
      await page.evaluate((id) => window.AIO_ARCH.navigate(id), route);
      await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioVerticalSlice, canonicalRoute);
      const reentry = await page.evaluate((canonical) => document.getElementById(`page-${canonical}`)?.dataset.aioVerticalSlice || null, canonicalRoute);
      if (reentry !== slice.id) throw new Error(`slice re-entry marker failed: ${slice.id}/${route}/${reentry}`);
      routeResults.push({ route, state: first.state, completeness: first.completeness, controls: first.controls, reentry });
    }
    report.slices.push({ id: slice.id, routes: routeResults, acceptance: slice.acceptance.length });
  }
} catch (error) {
  report.ok = false;
  report.errors.push(String(error?.stack || error));
} finally {
  await browser.close();
  server.kill();
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok || report.errors.length || report.slices.length !== 13) process.exitCode = 1;
