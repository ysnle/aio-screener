import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SCREENER_AUTO_TEST_PORT || 8913);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    child.stdout.on('data', (data) => {
      if (!ready && String(data).includes('AIO local server')) {
        ready = true;
        resolveServer(child);
      }
    });
    child.stderr.on('data', (data) => process.stderr.write(`[screener-auto/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(() => { if (!ready) { ready = true; resolveServer(child); } }, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/net::ERR_FAILED|Failed to load resource|^\[AIO:api\] [\w-]+: warn .* error/.test(message.text())) runtimeErrors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800, { timeout: 30000 });
  await page.evaluate(() => window.showPage('screener'));
  await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length === 12, { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const visible = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')]
      .map((node) => node.getAttribute('data-aio-screener-ticker')).filter(Boolean);
    const registered = visible.filter((symbol) => (window._aioQuoteRequestSymbols || []).includes(symbol));
    const observedAt = new Date().toISOString();
    const revision = `ci-visible-quotes:${observedAt}`;
    window._liveData = window._liveData || {};
    visible.forEach((symbol, index) => {
      window._liveData[symbol] = {
        ...(window._liveData[symbol] || {}),
        price: 100 + index,
        pct: index % 2 ? -0.25 : 0.25,
        marketCap: (100 + index) * 1e9,
        observedAt,
        fetchedAt: observedAt,
        source: 'ci-fixture:visible-quote',
        revision,
        changeBasis: 'previous-regular-session-close'
      };
    });
    document.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { source: 'ci-fixture' } }));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    const catalog = window.AIO_ARCH.getRuntimeObservationCatalog();
    const timeline = window.AIO_ARCH.getPageDataTimelineState('screener');
    const state = window.AIO_ARCH.getScreenerState();
    const prices = [...document.querySelectorAll('#screener-results-body td[data-column-key="price"]')].map((node) => node.textContent.trim());
    return {
      visible,
      registered,
      prices,
      visibleQuotes: catalog['screener.visibleQuotes'],
      timeline,
      ranking: state.metadata?.ranking || null
    };
  });

  if (runtimeErrors.length) throw new Error(`runtime errors: ${runtimeErrors.join(' | ')}`);
  if (result.visible.length !== 12 || result.registered.length !== result.visible.length) throw new Error(`visible quote demand ${result.registered.length}/${result.visible.length}`);
  if (result.prices.length !== 12 || result.prices.some((value) => !value || value === '—')) throw new Error(`visible prices not rendered: ${JSON.stringify(result.prices)}`);
  if (result.visibleQuotes?.available === false || result.visibleQuotes?.value !== 1 || !result.visibleQuotes?.observedAt) throw new Error(`visible quote coverage invalid: ${JSON.stringify(result.visibleQuotes)}`);
  const requiredFailures = result.timeline.checks.filter((check) => check.required && check.status !== 'PASS');
  if (result.timeline.checks.length !== 6 || requiredFailures.length) throw new Error(`required quant timeline failed: ${JSON.stringify(requiredFailures)}`);
  if (!result.ranking?.available || result.ranking?.inputVersion !== result.timeline.checks.find((check) => check.id === 'screener.snapshot')?.revision) throw new Error(`ranking revision mismatch: ${JSON.stringify(result.ranking)}`);
  if ((result.ranking.activeFactors || []).includes('value') || (result.ranking.activeFactors || []).includes('quality')) throw new Error(`stale fundamentals activated ranking factors: ${JSON.stringify(result.ranking.activeFactors)}`);

  console.log(JSON.stringify({
    ok: true,
    visibleRows: result.visible.length,
    registeredQuotes: result.registered.length,
    quoteCoverage: result.visibleQuotes.value,
    timelineStatus: result.timeline.status,
    requiredPasses: result.timeline.checks.filter((check) => check.required && check.status === 'PASS').length,
    activeFactors: result.ranking.activeFactors,
    optionalUnavailable: result.timeline.optionalUnavailable,
    runtimeErrors: 0
  }));
} finally {
  await browser.close();
  server.kill();
}
