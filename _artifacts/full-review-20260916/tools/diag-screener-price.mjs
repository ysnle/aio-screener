import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const port = Number(process.env.AIO_DIAG_PORT || 8914);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    child.stdout.on('data', (data) => { if (!ready && String(data).includes('AIO local server')) { ready = true; resolveServer(child); } });
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(() => { if (!ready) { ready = true; resolveServer(child); } }, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const fixtureEpoch = Date.parse(JSON.parse(readFileSync(resolve(root, 'public-data/screener.json'), 'utf8')).asOf) + 3600000;
  await page.clock.setFixedTime(new Date(fixtureEpoch));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800, { timeout: 30000 });
  await page.evaluate(() => window.showPage('screener'));
  await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length === 12, { timeout: 30000 });

  const before = await page.evaluate(() => {
    const rows = window.AIO_ARCH.getScreenerState().rows;
    const visible = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')].map((n) => n.getAttribute('data-aio-screener-ticker'));
    const sample = visible.slice(0, 3).map((sym) => {
      const row = rows.find((r) => r.sym === sym) || {};
      return { sym, currency: row.currency ?? null, instrumentRef: row.instrumentRef ?? null, rowPrice: row.price ?? null, hasFieldReadiness: !!row.fieldReadiness };
    });
    return { visibleSample: sample, liveDataSample: visible.slice(0, 3).map((sym) => ({ sym, entry: window._liveData?.[sym] ?? null })), liveDataCount: Object.keys(window._liveData || {}).length };
  });
  console.log('BEFORE stub:', JSON.stringify(before, null, 1));

  const after = await page.evaluate(async () => {
    const rows = window.AIO_ARCH.getScreenerState().rows;
    const visible = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')].map((n) => n.getAttribute('data-aio-screener-ticker')).filter(Boolean);
    const observedAt = new Date().toISOString();
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
        revision: `diag:${observedAt}`,
        changeBasis: 'previous-regular-session-close'
      };
    });
    document.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { source: 'ci-fixture' } }));
    await new Promise((r) => setTimeout(r, 500));
    const prices = [...document.querySelectorAll('#screener-results-body td[data-column-key="price"]')].map((n) => n.textContent.trim());
    const rowInfo = visible.slice(0, 3).map((sym) => {
      const row = rows.find((r) => r.sym === sym) || {};
      return { sym, currency: row.currency ?? null, instrumentRefCurrency: row.instrumentRef?.currency ?? null, liveCurrency: window._liveData[sym]?.currency ?? null, livePrice: window._liveData[sym]?.price ?? null, rowPrice: row.price ?? null };
    });
    return { prices, rowInfo };
  });
  console.log('AFTER stub:', JSON.stringify(after, null, 1));
} finally {
  await browser.close();
  server.kill();
}
