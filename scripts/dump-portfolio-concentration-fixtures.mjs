import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03 continued (2026-07-21, P758): dumps (scenario, legacy window.calcPortfolioTechnicalRisk()
// output) tuples by driving the REAL, unmodified js/aio-core.js function inside a real Chromium
// page. Positions are given empty OHLCV so calcSellPressure's insufficient-data path (score:0,
// verified fail-closed in calcSellPressure itself) isolates topWeightPct/concentrationPenalty as
// the only real signal in the dumped heatScore — this fixture targets ONLY that narrow slice
// (Fable/Explore-recommended scope), not the full sell-pressure technical model.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/portfolio-concentration-golden.json');

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-portfolio-concentration/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const SCENARIOS = [
  { name: 'empty_portfolio', positions: [] },
  { name: 'single_position_no_concentration_penalty', positions: [{ ticker: 'AAA', qty: 10, price: 50 }] },
  { name: 'two_even_positions_below_10pct_each', positions: Array.from({ length: 12 }, (_, i) => ({ ticker: 'T' + i, qty: 1, price: 100 })) },
  { name: 'one_position_15pct_tier', positions: [{ ticker: 'BIG', qty: 15, price: 100 }, ...Array.from({ length: 8 }, (_, i) => ({ ticker: 'T' + i, qty: 1, price: 100 })) ] },
  { name: 'one_position_25pct_extreme_tier', positions: [{ ticker: 'HUGE', qty: 30, price: 100 }, ...Array.from({ length: 7 }, (_, i) => ({ ticker: 'T' + i, qty: 1, price: 100 })) ] },
  { name: 'explicit_total_value_overrides_computed', positions: [{ ticker: 'AAA', qty: 10, price: 50, value: 500 }], context: { totalValue: 2000 } },
  { name: 'position_weightPct_fallback_when_no_totalValue', positions: [{ ticker: 'AAA', qty: 0, price: 0, weightPct: 30 }] },
  { name: 'boundary_exactly_10_15_25_pct', positions: [{ ticker: 'A', qty: 10, price: 1 }, { ticker: 'B', qty: 15, price: 1 }, { ticker: 'C', qty: 25, price: 1 }, { ticker: 'D', qty: 50, price: 1 }] }
];

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.calcPortfolioTechnicalRisk === 'function', { timeout: 30000 });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const dumped = await page.evaluate(({ positions, context }) => {
      // riskItems mirrors positions 1:1 with no pre-computed .action/.score, each with empty
      // ohlcv (so calcPositionTechnicalRisk computes calcTechnicalSnapshot([]) -> {ok:false} ->
      // calcSellPressure returns score:0 deterministically, isolating the concentration signal).
      const riskItems = positions.map((p) => ({ ...p, snapshot: [] }));
      return window.calcPortfolioTechnicalRisk(positions, riskItems, context || {});
    }, { positions: scenario.positions, context: scenario.context });
    fixtures.push({ name: scenario.name, inputs: { positions: scenario.positions, context: scenario.context || {} }, legacyOutput: dumped });
  }
  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFunction: 'js/aio-core.js:calcPortfolioTechnicalRisk (topWeightPct/items[].weightPct+concentrationPenalty slice only)', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
