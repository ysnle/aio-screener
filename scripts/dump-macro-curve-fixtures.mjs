import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03 continued (2026-07-21, P757): dumps (scenario, legacy window.AIO.getUsTreasuryCurveEvidence()
// output) tuples by driving the REAL, unmodified js/aio-core.js function inside a real Chromium
// page — the golden fixture src/domain/macro/treasury-curve.js's parity gate compares against.
// MUST be run against the pre-extraction commit (before getUsTreasuryCurveEvidence is rewritten to
// call window.AIO_ARCH) — re-run via `git stash` back to that state any time the legacy wrapper
// changes in a way that should not change this model's behavior, to refresh the golden file.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/macro-curve-golden.json');

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-macro-curve/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const SCENARIOS = [
  { name: 'all_sources_present_fred_spread_wins', setup: { liveData: { '^IRX': { price: 5.1 }, '^FVX': { price: 4.5 }, '^TNX': { price: 4.4 }, '^TYX': { price: 4.6 } }, live2Y: 4.2, live10Y: null, live30Y: null, fredData: { DGS3MO: { value: 5.05 }, DGS2: { value: 4.15 }, DGS5: { value: 4.45 }, DGS10: { value: 4.38 }, DGS30: { value: 4.58 }, T10Y2Y: { value: 0.23 } }, snapshot: {} } },
  { name: 'no_fred_t10y2y_falls_back_to_live_derived', setup: { liveData: { '^TNX': { price: 4.4 } }, live2Y: 4.1, live10Y: null, live30Y: null, fredData: {}, snapshot: {} } },
  { name: 'no_live_no_fred_spread_falls_back_to_snapshot', setup: { liveData: {}, live2Y: null, live10Y: null, live30Y: null, fredData: {}, snapshot: { t10y2y: 0.19, tnx: 4.3, irx: 5.0, fvx: 4.4, tyx: 4.55 } } },
  { name: 'twoY_and_tenY_present_no_direct_spread_source', setup: { liveData: {}, live2Y: null, live10Y: null, live30Y: null, fredData: { DGS2: { value: 4.3 }, DGS10: { value: 4.5 } }, snapshot: {} } },
  { name: 'nothing_available', setup: { liveData: {}, live2Y: null, live10Y: null, live30Y: null, fredData: {}, snapshot: {} } },
  { name: 'out_of_range_values_clamped_to_null', setup: { liveData: { '^TNX': { price: 999 }, '^IRX': { price: -50 } }, live2Y: 4.1, live10Y: null, live30Y: null, fredData: { DGS2: { value: 4.15 } }, snapshot: {} } },
  { name: 'partial_only_twoY_no_tenY_anywhere', setup: { liveData: {}, live2Y: 4.0, live10Y: null, live30Y: null, fredData: {}, snapshot: {} } },
  { name: 'live10Y_and_live30Y_used_as_tenY_thirtyY_fallback', setup: { liveData: {}, live2Y: 4.05, live10Y: 4.42, live30Y: 4.6, fredData: {}, snapshot: {} } }
];

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function', { timeout: 30000 });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const dumped = await page.evaluate(({ setup }) => {
      window._liveData = setup.liveData;
      window._fredData = setup.fredData;
      window._live2Y = setup.live2Y;
      window._live10Y = setup.live10Y;
      window._live30Y = setup.live30Y;
      window.DATA_SNAPSHOT = { ...setup.snapshot };
      return window.AIO.getUsTreasuryCurveEvidence();
    }, { setup: scenario.setup });
    fixtures.push({ name: scenario.name, inputs: scenario.setup, legacyOutput: dumped });
  }
  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFunction: 'js/aio-core.js:window.AIO.getUsTreasuryCurveEvidence', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
