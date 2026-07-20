import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03 item 2: dumps (ohlcv scenario, legacy calcTechnicalSnapshot + updateMTF output) tuples by
// driving the REAL, unmodified js/aio-core.js:calcTechnicalSnapshot and index.html:updateMTF
// inside a real Chromium page — this is the "legacy 입출력 덤프" golden fixture the Weinstein/MTF
// extraction's parity gate compares src/domain/technical/stage.js
// (classifyMovingAverageStructure/deriveMultiTimeframeView) against. MUST be run against the
// pre-extraction commit (before calcTechnicalSnapshot/updateMTF were rewritten to call
// window.AIO_ARCH) — re-run via `git stash` back to that state any time their legacy wrapper
// changes in a way that should not change Weinstein/MTF behavior, to refresh the golden file.
//
// For each scenario we also dump calcTechnicalSnapshot(bars.slice(0, -5)) so the parity check can
// read its `sma50` as the legacy "5 trading days ago" SMA50 probe (`sma50_5d` in the legacy
// function) — that value isn't part of the main snapshot's return shape, so we source it from the
// same real function on a shifted window instead of reimplementing the SMA arithmetic here.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/weinstein-mtf-golden.json');

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-weinstein-mtf/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

function bars(n, closeFn) {
  return Array.from({ length: n }, (_, i) => ({ close: closeFn(i), volume: 1_000_000 + i, time: `2025-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}` }));
}

const SCENARIOS = [
  { name: 'linear_uptrend_220', ohlcv: bars(220, (i) => 100 + i * 0.5) },
  { name: 'linear_downtrend_220', ohlcv: bars(220, (i) => 210 - i * 0.5) },
  { name: 'rally_then_rollover_220', ohlcv: bars(220, (i) => (i < 180 ? 100 + i * 0.6 : 208 - (i - 180) * 1.1)) },
  { name: 'gentle_stall_near_top_220', ohlcv: bars(220, (i) => (i < 210 ? 100 + i * 0.6 : 226 - (i - 210) * 0.15)) },
  { name: 'decline_then_recovery_220', ohlcv: bars(220, (i) => (i < 180 ? 200 - i * 0.5 : 110 + (i - 180) * 1.2)) },
  { name: 'choppy_sideways_220', ohlcv: bars(220, (i) => 150 + 8 * Math.sin(i / 6)) },
  { name: 'insufficient_bars_25', ohlcv: bars(25, (i) => 100 + i * 0.3) },
  { name: 'just_above_200_bars', ohlcv: bars(205, (i) => 140 + 5 * Math.sin(i / 9) + i * 0.05) }
];

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.calcTechnicalSnapshot === 'function' && typeof window.updateMTF === 'function', { timeout: 30000 });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const dumped = await page.evaluate(({ ohlcv }) => {
      const snapshot = window.calcTechnicalSnapshot(ohlcv);
      const priorSnapshot = ohlcv.length > 5 ? window.calcTechnicalSnapshot(ohlcv.slice(0, -5)) : { ok: false };
      const mtf = window.updateMTF(snapshot);
      return { snapshot, sma50Prior: priorSnapshot.ok ? priorSnapshot.sma50 : null, mtf };
    }, { ohlcv: scenario.ohlcv });
    fixtures.push({ name: scenario.name, barCount: scenario.ohlcv.length, ...dumped });
  }
  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFunction: 'js/aio-core.js:calcTechnicalSnapshot, index.html:updateMTF', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
