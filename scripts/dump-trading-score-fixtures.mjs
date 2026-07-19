import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03: dumps (scenario inputs, legacy computeTradingScore output) pairs by driving the REAL,
// unmodified js/aio-core.js function inside a real Chromium page — this is the "legacy 입출력
// 덤프" golden fixture the extraction's parity gate compares the extracted pure function against.
// Re-run this (against the pre-extraction commit) any time computeTradingScore's legacy wrapper
// changes in a way that should not change scoring behavior, to refresh the golden file.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/trading-score-golden.json');

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-trading-score/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const SCENARIOS = [
  {
    name: 'bull_full_data',
    mode: 'swing',
    inputs: {
      liveData: { '^VIX': { price: 13.5 }, '^VVIX': { price: 78 }, 'DX-Y.NYB': { price: 101.2 }, '^TNX': { price: 3.9 }, 'CL=F': { price: 74 }, 'RSP': { price: 165 }, 'SPY': { price: 560 }, '^GSPC': { price: 5600, chartPreviousClose: 5580 } },
      spxMA: { 50: 5450, 200: 5200 }, spxMATsFreshMs: 0,
      fg: { value: 62, allowedUse: 'decision', status: 'CURRENT' },
      breadth: { available: true, sma20: 71 },
      pcr: 0.85, hyBp: 290,
      decisionEvidenceRows: [{ id: 'pcr-putcall', status: 'verified_current' }, { id: 'hy-spread-bp', status: 'verified_current' }],
      newsSentimentScore: 62, newsRiskImpacts: []
    }
  },
  {
    name: 'bear_crisis_full_data',
    mode: 'swing',
    inputs: {
      liveData: { '^VIX': { price: 41 }, '^VVIX': { price: 128 }, 'DX-Y.NYB': { price: 112.4 }, '^TNX': { price: 4.9 }, 'CL=F': { price: 106 }, 'RSP': { price: 130 }, 'SPY': { price: 470 }, '^GSPC': { price: 4600, chartPreviousClose: 4650 } },
      spxMA: { 50: 4900, 200: 5000 }, spxMATsFreshMs: 0,
      fg: { value: 11, allowedUse: 'decision', status: 'CURRENT' },
      breadth: { available: true, sma20: 14 },
      pcr: 1.55, hyBp: 540,
      decisionEvidenceRows: [{ id: 'pcr-putcall', status: 'verified_current' }, { id: 'hy-spread-bp', status: 'verified_current' }],
      newsSentimentScore: 18, newsRiskImpacts: [{ impact: -6 }, { impact: -4 }]
    }
  },
  {
    name: 'all_null_unavailable',
    mode: 'swing',
    inputs: {
      liveData: {}, spxMA: null, spxMATsFreshMs: null,
      fg: { value: null, allowedUse: false, status: 'UNAVAILABLE' },
      breadth: { available: false, sma20: null },
      pcr: null, hyBp: null,
      decisionEvidenceRows: [],
      newsSentimentScore: 50, newsRiskImpacts: []
    }
  },
  {
    name: 'mixed_partial_coverage',
    mode: 'swing',
    inputs: {
      liveData: { '^VIX': { price: 19 }, 'CL=F': { price: 80 } },
      spxMA: null, spxMATsFreshMs: null,
      fg: { value: 48, allowedUse: 'decision', status: 'CURRENT' },
      breadth: { available: false, sma20: null },
      pcr: null, hyBp: null,
      decisionEvidenceRows: [],
      newsSentimentScore: 50, newsRiskImpacts: []
    }
  },
  {
    name: 'day_mode_elevated_vix',
    mode: 'day',
    inputs: {
      liveData: { '^VIX': { price: 22 }, '^VVIX': { price: 90 }, 'DX-Y.NYB': { price: 103 }, '^TNX': { price: 4.1 }, 'CL=F': { price: 78 }, 'RSP': { price: 150 }, 'SPY': { price: 520 }, '^GSPC': { price: 5300, chartPreviousClose: 5290 } },
      spxMA: { 50: 5250, 200: 5100 }, spxMATsFreshMs: 0,
      fg: { value: 50, allowedUse: 'decision', status: 'CURRENT' },
      breadth: { available: true, sma20: 60 },
      pcr: 1.0, hyBp: 300,
      decisionEvidenceRows: [{ id: 'pcr-putcall', status: 'verified_current' }, { id: 'hy-spread-bp', status: 'verified_current' }],
      newsSentimentScore: 50, newsRiskImpacts: []
    }
  },
  {
    name: 'dangerous_rally_divergence',
    mode: 'swing',
    inputs: {
      liveData: { '^VIX': { price: 16 }, '^VVIX': { price: 80 }, 'DX-Y.NYB': { price: 100 }, '^TNX': { price: 4.0 }, 'CL=F': { price: 72 }, 'RSP': { price: 150 }, 'SPY': { price: 540 }, '^GSPC': { price: 5600, chartPreviousClose: 5590 } },
      spxMA: { 50: 5400, 200: 5100 }, spxMATsFreshMs: 0,
      fg: { value: 60, allowedUse: 'decision', status: 'CURRENT' },
      breadth: { available: true, sma20: 20 },
      pcr: 0.9, hyBp: 300,
      decisionEvidenceRows: [{ id: 'pcr-putcall', status: 'verified_current' }, { id: 'hy-spread-bp', status: 'verified_current' }],
      newsSentimentScore: 50, newsRiskImpacts: []
    }
  },
  {
    name: 'bottoming_divergence',
    mode: 'swing',
    inputs: {
      liveData: { '^VIX': { price: 24 }, '^VVIX': { price: 95 }, 'DX-Y.NYB': { price: 103 }, '^TNX': { price: 4.2 }, 'CL=F': { price: 82 }, 'RSP': { price: 140 }, 'SPY': { price: 490 }, '^GSPC': { price: 4850 } },
      spxMA: { 50: 5100, 200: 5050 }, spxMATsFreshMs: 0,
      fg: { value: 40, allowedUse: 'decision', status: 'CURRENT' },
      breadth: { available: true, sma20: 62 },
      pcr: 1.05, hyBp: 300,
      decisionEvidenceRows: [{ id: 'pcr-putcall', status: 'verified_current' }, { id: 'hy-spread-bp', status: 'verified_current' }],
      newsSentimentScore: 50, newsRiskImpacts: []
    }
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
  await page.waitForFunction(() => typeof window.computeTradingScore === 'function', { timeout: 30000 });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const output = await page.evaluate(({ mode, inputs }) => {
      window._aioScoreCache = {};
      window._liveData = inputs.liveData;
      window._spxMA = inputs.spxMA;
      window._spxMATs = inputs.spxMATsFreshMs == null ? null : Date.now() - inputs.spxMATsFreshMs;
      window._putCallRatio = inputs.pcr;
      window._hySpreadBp = inputs.hyBp;
      window.computeNewsSentimentScore = () => ({ score: inputs.newsSentimentScore });
      window.computeNewsRiskSignals = () => inputs.newsRiskImpacts;
      window.AIO = window.AIO || {};
      window.AIO.getCanonicalMetric = (metric) => (metric === 'fg' ? inputs.fg : null);
      window.AIO.getCurrentBreadthEvidence = () => inputs.breadth;
      window.AIO.getTradingDecisionInputEvidence = () => ({ status: 'ok', rows: inputs.decisionEvidenceRows });
      window.AIO.getDecisionEvidenceBundle = () => null;
      return window.computeTradingScore(mode);
    }, { mode: scenario.mode, inputs: scenario.inputs });
    fixtures.push({ name: scenario.name, mode: scenario.mode, inputs: scenario.inputs, legacyOutput: output });
  }
  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFunction: 'js/aio-core.js:computeTradingScore', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
