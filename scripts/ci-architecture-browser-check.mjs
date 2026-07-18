import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8897);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[architecture-browser/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/net::ERR_FAILED/.test(message.text()) && !/^\[AIO:api\] proxy-primary: warn → error/.test(message.text())) errors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.showPage === 'function', { timeout: 30000 });
  } catch (error) {
    console.error(JSON.stringify({ waitError: error.message, errors, runtime: await page.evaluate(() => ({ arch: typeof window.AIO_ARCH, showPage: typeof window.showPage, readyState: document.readyState, scripts: [...document.scripts].map((script) => script.src || 'inline').slice(-8) })) }));
    throw error;
  }

  const boot = await page.evaluate(() => ({
    status: window.AIO_ARCH.status,
    summaryBlocked: window.AIO_ARCH.getSentimentSummary().blocked,
    state: window.AIO_ARCH.getState()
  }));
  if (boot.status !== 'MIGRATION_IN_PROGRESS') throw new Error(`unexpected architecture status: ${boot.status}`);
  if (!boot.summaryBlocked) throw new Error('offline sentiment must remain blocked');

  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  const sentimentRoute = await page.evaluate(() => ({
    active: window.AIO_ARCH.router.active(),
    state: document.getElementById('sent-overall-badge')?.dataset.aioArchitectureState,
    evidenceId: document.getElementById('sent-overall-badge')?.dataset.aioEvidenceId || null
  }));
  if (sentimentRoute.active !== 'sentiment' || sentimentRoute.state !== 'blocked') throw new Error(`sentiment lifecycle failed: ${JSON.stringify(sentimentRoute)}`);

  await page.evaluate(() => window.showPage('home'));
  await page.waitForFunction(() => !document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute);
  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, boot, sentimentRoute, routeRoundTrip: true, browserErrors: 0 }));
} finally {
  await browser.close();
  server.kill();
}
