import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SA04_PORT || 8900);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const QUOTE_REQUEST_CEILING = 100;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[sa04/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const external = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
    external.push(url);
    return route.abort();
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && !!window._serverDataMeta
    && Object.prototype.hasOwnProperty.call(window._serverDataMeta, 'fredFetchOk')
    && Object.prototype.hasOwnProperty.call(window._serverDataMeta, 'hyOAS'), { timeout: 30000 });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 7000));
  const decodedExternal = external.map((url) => decodeURIComponent(url));
  const fredHyRequests = decodedExternal.filter((url) => /fred|stlouisfed|bamlh0a0hym2/i.test(url)).length;
  const quoteRequests = decodedExternal.filter((url) => /finance\/chart|stooq|finance\.naver|stock\.naver|polling\.finance\.naver|fchart\.stock\.naver/i.test(url)).length;
  const evidence = await page.evaluate(() => ({
    serverFredReady: window._serverDataMeta?.fredFetchOk === true,
    serverHyReady: !!window._serverDataMeta?.hyOAS,
    serverHyFieldPresent: Object.prototype.hasOwnProperty.call(window._serverDataMeta || {}, 'hyOAS'),
    refreshFred: window.REFRESH_SCHEDULE?.fred?._lastRun || null,
    refreshHy: window.REFRESH_SCHEDULE?.hySpread?._lastRun || null,
    quoteRequestPolicy: 'snapshot-backed outage ceiling'
  }));
  const providerBoundaryObserved = typeof evidence.serverFredReady === 'boolean' && evidence.serverHyFieldPresent === true;
  const ok = providerBoundaryObserved && fredHyRequests === 0 && quoteRequests <= QUOTE_REQUEST_CEILING;
  console.log(JSON.stringify({ ok, fixture: 'SA-04 boot-network-budget', quoteRequestCeiling: QUOTE_REQUEST_CEILING, totalExternalRequests: external.length, quoteRequests, fredHyRequests, evidence }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
