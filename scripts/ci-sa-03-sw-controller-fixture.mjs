import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SA03_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const appVersion = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const oldVersion = 'v53.17';

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[sa03/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript(({ oldVersion, appVersion }) => {
    let controllerVersion = oldVersion;
    const listeners = {};
    const state = { version: controllerVersion, queries: 0, changes: 0, registrations: 0 };
    const controller = {
      postMessage(_message, transfer) {
        state.queries += 1;
        state.version = controllerVersion;
        const port = transfer?.[0];
        if (port) setTimeout(() => port.postMessage({ version: controllerVersion }), 0);
      }
    };
    const serviceWorker = {
      get controller() { return controller; },
      addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
      register() {
        state.registrations += 1;
        return Promise.resolve({
          scope: location.origin + '/',
          update() {},
          addEventListener() {}
        });
      },
      __triggerControllerChange() {
        controllerVersion = appVersion;
        state.changes += 1;
        state.version = controllerVersion;
        (listeners.controllerchange || []).forEach((listener) => listener());
      }
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
    window.__aioSa03 = state;
    window.__aioSa03Trigger = () => serviceWorker.__triggerControllerChange();
  }, { oldVersion, appVersion });
  let navigations = 0;
  page.on('framenavigated', () => { navigations += 1; });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction((oldVersion) => window._aioSWVersion === oldVersion, oldVersion, { timeout: 30000 });
  const before = await page.evaluate(() => ({ version: window._aioSWVersion, state: window.__aioSa03 }));
  const navigationsBeforeControllerChange = navigations;
  await page.evaluate(() => window.__aioSa03Trigger());
  await page.waitForFunction((appVersion) => window._aioSWVersion === appVersion && window._aioSWMismatchLogged === '', appVersion, { timeout: 30000 });
  const after = await page.evaluate(() => ({ version: window._aioSWVersion, mismatch: window._aioSWMismatchLogged, state: window.__aioSa03 }));
  const ok = before.version === oldVersion && before.state.queries === 1
    && after.version === appVersion && after.mismatch === ''
    && after.state.changes === 1 && after.state.queries === 2 && navigations === navigationsBeforeControllerChange;
  console.log(JSON.stringify({ ok, fixture: 'SA-03 SW-controller-fixture', appVersion, oldVersion, before, after, navigations, navigationsBeforeControllerChange }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
