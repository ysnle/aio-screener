import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { stagePagesCode } from './lib/pages-bundle-config.mjs';

// A real staged worker. Initial page requests predate controller takeover, so no controlled reload may precede the first disconnect.
const root = fileURLToPath(new URL('..', import.meta.url));
const stage = mkdtempSync(join(tmpdir(), 'aio-offline-browser-'));
let server, proxy, browser;
try {
  const pages = stagePagesCode(root, join(stage, 'pages'));
  execFileSync(process.execPath, ['scripts/build-pages-bundle.mjs', pages], { cwd: root });
  server = await startLocalServer(0, { label: 'offline-browser/server', env: { AIO_SERVE_ROOT: pages, AIO_BROWSER_CLOCK_AT: '' } });
  let documentDown = false;
  let unboundBootstrapRequests = 0;
  proxy = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (documentDown && ['/', '/index.html'].includes(url.pathname)) {
      response.writeHead(503).end('document unavailable');
      return;
    }
    if (documentDown && url.pathname === '/src/app/bootstrap.js') {
      unboundBootstrapRequests++;
      response.writeHead(200, { 'Content-Type': 'text/javascript' }).end('throw new Error("wrong boot generation");');
      return;
    }
    try {
      const upstream = await fetch(`http://127.0.0.1:${server.port}${url.pathname}${url.search}`);
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (_) { response.writeHead(502).end(); }
  });
  await new Promise((ready, reject) => proxy.once('error', reject).listen(0, 'localhost', ready));
  const origin = `http://localhost:${proxy.address().port}`;
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR' });
    try {
      await context.addInitScript(() => {
        window.__aioUserBoot = true;
        localStorage.setItem('aio_disclaimer_ack_v1', '1');
      });
      await context.route((url) => url.origin !== origin, (route) => route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let navigations = 0;
      page.on('request', (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations += 1; });
      const path = `/index.html${width === 390 ? '?offline-check=1' : ''}#macro?view=releases`;
      const waitForMacro = () => page.waitForFunction(() => document.querySelector('#page-macro.active[data-view="releases"]')?.dataset.aioRouteModuleState === 'ready');
      await page.goto(origin + path, { waitUntil: 'load' });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await waitForMacro();
      assert.equal(navigations, 1, 'First control must occur on the original document');
      const shellAsset = (file) => page.evaluate(async (name) => {
        const cache = await caches.open((await caches.keys()).find((key) => key.startsWith('aio-shell-')));
        return Boolean(await cache.match(name));
      }, file);
      assert.equal(await shellAsset('/src/ui/styles/responsive.css'), false, 'The first visit did not warm the stylesheet in CacheStorage');

      await context.setOffline(true);
      const cold = await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(cold.status(), 503, 'The worker must serve an honest offline recovery document');
      await page.getByRole('heading', { name: '연결을 확인해 주세요' }).waitFor();
      assert.equal(page.url(), origin + path, 'Offline recovery must retain the original route and query');
      assert.deepEqual(errors, [], 'The incomplete app must not execute any scripts');

      await context.setOffline(false);
      await page.getByRole('button', { name: '다시 시도' }).click();
      await waitForMacro();
      assert.equal(page.url(), origin + path, 'Retry must open the original route');
      await page.waitForFunction(async () => {
        const cache = await caches.open((await caches.keys()).find((key) => key.startsWith('aio-shell-')));
        const urls = [...document.querySelectorAll('script[src*="?v="], link[rel="stylesheet"][href^="src/"], script[type="module"][src], link[rel="modulepreload"]')]
          .map((node) => node.src || node.href);
        return urls.length > 8 && (await Promise.all(urls.map((url) => caches.match(url)))).every(Boolean)
          && !!await cache.match('/src/ui/styles/responsive.css');
      });

      await context.setOffline(true);
      const warmed = await page.goto(origin + '/?offline-check=2#macro?view=releases', { waitUntil: 'domcontentloaded' });
      assert.equal(warmed.status(), 200, 'A complete cached release must remain usable through the root alias');
      await waitForMacro();
      assert.deepEqual(errors, [], 'The warmed application must boot without errors');

      await context.setOffline(false);
      documentDown = true;
      const partialOutage = await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(partialOutage.status(), 200, 'Keep serving the validated cached release in a partial origin outage');
      await waitForMacro();
      assert.equal(unboundBootstrapRequests, 0, 'Cached HTML must load its cached bootstrap even when the origin serves another generation');
      assert.deepEqual(errors, []);
      documentDown = false;
      await context.setOffline(true);
      await page.evaluate(async () => {
        const shell = await caches.open((await caches.keys()).find((key) => key.startsWith('aio-shell-')));
        await shell.put('/src/ui/styles/responsive.css', new Response('/* different release */', { headers: { 'Content-Type': 'text/css' } }));
      });
      const mismatched = await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(mismatched.status(), 503, 'A cached URL with bytes from another release is insufficient');
      await page.getByRole('heading', { name: '연결을 확인해 주세요' }).waitFor();
      console.log(JSON.stringify({ width, cold: cold.status(), warmed: warmed.status(), partialOutage: partialOutage.status(), mismatched: mismatched.status(), recoveredRoute: path, errors }));
    } finally {
      await context.close();
    }
  }
} finally {
  await closeAll({ browser, server });
  if (proxy?.listening) await new Promise((resolve) => proxy.close(resolve));
  rmSync(stage, { recursive: true, force: true });
}
