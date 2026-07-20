import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03 item 2: dumps (scenario inputs, legacy calcLiveRS output) pairs by driving the REAL,
// unmodified index.html calcLiveRS/classifyRRG inside a real Chromium page — this is the "legacy
// 입출력 덤프" golden fixture the RRG extraction's parity gate compares the extracted pure
// function (src/domain/themes/rrg.js:computeRelativeRotation) against. MUST be run against the
// pre-extraction commit (before calcLiveRS was rewritten to call window.AIO_ARCH) — re-run via
// `git stash` back to that state any time calcLiveRS's legacy wrapper changes in a way that should
// not change RRG behavior, to refresh the golden file.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/rrg-golden.json');

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-rrg/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

function series(length, fn) { return Array.from({ length }, (_, i) => fn(i)); }

const SCENARIOS = [
  {
    name: 'steady_outperform',
    sym: 'XLK',
    history: series(40, (i) => 100 + i * 0.8),
    benchmarkHistory: series(40, (i) => 100 + i * 0.3),
    hasQuote: true, hasBenchmarkQuote: true
  },
  {
    name: 'decelerating_outperform',
    sym: 'XLY',
    history: series(40, (i) => (i < 25 ? 100 + i * 1.2 : 130 + (i - 25) * 0.1)),
    benchmarkHistory: series(40, (i) => 100 + i * 0.4),
    hasQuote: true, hasBenchmarkQuote: true
  },
  {
    name: 'underperform_recovering',
    sym: 'XLU',
    history: series(40, (i) => (i < 25 ? 100 - i * 0.5 : 87.5 + (i - 25) * 1.0)),
    benchmarkHistory: series(40, (i) => 100 + i * 0.05),
    hasQuote: true, hasBenchmarkQuote: true
  },
  {
    name: 'underperform_worsening',
    sym: 'XLE',
    history: series(40, () => 100),
    benchmarkHistory: series(40, (i) => 100 + i * 0.6),
    hasQuote: true, hasBenchmarkQuote: true
  },
  {
    name: 'quote_missing',
    sym: 'XLF',
    history: null,
    benchmarkHistory: null,
    hasQuote: false, hasBenchmarkQuote: false
  },
  {
    name: 'short_history_with_live_quote',
    sym: 'XLV',
    history: series(15, (i) => 100 + i),
    benchmarkHistory: series(15, (i) => 100 + i * 0.5),
    hasQuote: true, hasBenchmarkQuote: true
  },
  {
    name: 'benchmark_mostly_nonpositive',
    sym: 'XLB',
    history: series(30, (i) => 100 + i),
    benchmarkHistory: series(30, (i) => (i < 22 ? -5 : 100 + i)),
    hasQuote: true, hasBenchmarkQuote: true
  },
  {
    name: 'flat_series_both',
    sym: 'XLI',
    history: series(35, () => 50),
    benchmarkHistory: series(35, () => 50),
    hasQuote: true, hasBenchmarkQuote: true
  }
];

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.calcLiveRS === 'function', { timeout: 30000 });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const output = await page.evaluate(({ sym, history, benchmarkHistory, hasQuote, hasBenchmarkQuote }) => {
      window._priceHistory = window._priceHistory || {};
      window._liveData = window._liveData || {};
      if (history) window._priceHistory[sym] = history; else delete window._priceHistory[sym];
      if (benchmarkHistory) window._priceHistory['SPY'] = benchmarkHistory; else delete window._priceHistory['SPY'];
      if (hasQuote) window._liveData[sym] = { price: 100, pct: 1 }; else delete window._liveData[sym];
      if (hasBenchmarkQuote) window._liveData['SPY'] = { price: 500, pct: 0.5 }; else delete window._liveData['SPY'];
      return window.calcLiveRS(sym);
    }, scenario);
    fixtures.push({ name: scenario.name, inputs: scenario, legacyOutput: output });
  }
  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFunction: 'index.html:calcLiveRS/classifyRRG', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
