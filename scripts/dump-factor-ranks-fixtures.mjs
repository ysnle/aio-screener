import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03 continued (2026-07-21, P759, Fable-advisor design): dumps (scenario, legacy
// window._aioComputeFactorRanks() row mutations + 4 window globals) tuples by driving the REAL,
// unmodified js/aio-data.js function inside a real Chromium page — the golden fixture
// src/domain/screener/factor-ranks.js's parity gate compares against. MUST be run against the
// pre-extraction commit (before _aioComputeFactorRanks is rewritten to call window.AIO_ARCH) —
// re-run via `git stash` back to that state any time the legacy wrapper changes in a way that
// should not change this model's behavior, to refresh the golden file.
//
// window.AIO.marketState is deliberately left unset in every scenario so _aioFactorWeights(ms)
// takes its `if (ms) {...}` branch's false path and returns the deterministic NEUTRAL weight
// constant every time — regime-adaptive weighting itself is legacy's own dependency, not part of
// what this extraction covers (see factor-ranks.js's header comment on _aioFactorWeights scope).
//
// Includes both hand-built synthetic edge-case universes (Fable's recommendation #2: sector
// cardinality/tie density is itself under test here, unlike the scalar-input extractions before
// it) AND one dump of the REAL currently-loaded SCREENER_DB, breaking this repo's prior
// synthetic-only fixture precedent specifically because this is the first extraction where a
// dataset's emergent shape (real sector sizes, real tie density) is part of what's being verified.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/factor-ranks-golden.json');

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-factor-ranks/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const SECTORS_3 = ['Technology', 'Healthcare', 'Financials'];
function makeRow(sym, sector, i, opts = {}) {
  return {
    sym, sector,
    ret1m: opts.ret1m !== undefined ? opts.ret1m : (i % 7) - 3,
    ret3m: opts.ret3m !== undefined ? opts.ret3m : (i % 11) - 5,
    ret6m: opts.ret6m !== undefined ? opts.ret6m : (i % 13) - 6,
    pctSma50: opts.pctSma50 !== undefined ? opts.pctSma50 : (i % 9) - 4,
    pctSma200: opts.pctSma200 !== undefined ? opts.pctSma200 : (i % 15) - 7,
    vol: opts.vol !== undefined ? opts.vol : 15 + (i % 20),
    mcap: opts.mcap !== undefined ? opts.mcap : 1e9 * (1 + (i % 10)),
    _mcapObservedAt: opts.hasOwnProperty('_mcapObservedAt') ? opts._mcapObservedAt : new Date().toISOString(),
    pe: opts.pe !== undefined ? opts.pe : 10 + (i % 30),
    pb: opts.pb !== undefined ? opts.pb : 1 + (i % 5),
    evEbitda: opts.evEbitda !== undefined ? opts.evEbitda : 8 + (i % 15),
    roe: opts.roe !== undefined ? opts.roe : (i % 25) - 5,
    margin: opts.margin !== undefined ? opts.margin : (i % 20) - 5,
    revGrowth: opts.revGrowth !== undefined ? opts.revGrowth : (i % 20) - 5,
    kalmanVelConf: opts.kalmanVelConf !== undefined ? opts.kalmanVelConf : ((i % 7) - 3) / 10
  };
}

const SCENARIOS = [
  {
    name: 'normal_multi_sector_full_factors',
    serverScreener: { fundamentalCoveragePct: 90, fmpOk: true },
    rows: SECTORS_3.flatMap((sector, si) => Array.from({ length: 10 }, (_, i) => makeRow(`S${si}R${i}`, sector, si * 10 + i)))
  },
  {
    name: 'small_sectors_blend_and_universe_fallback',
    serverScreener: { fundamentalCoveragePct: 90, fmpOk: true },
    rows: [
      ...Array.from({ length: 8 }, (_, i) => makeRow(`PURE${i}`, 'Technology', i)),
      ...Array.from({ length: 3 }, (_, i) => makeRow(`BLEND${i}`, 'Energy', 20 + i)),
      makeRow('SOLO0', 'Utilities', 40),
      makeRow('SOLO1', 'RealEstate', 41)
    ]
  },
  {
    name: 'mcap_coverage_below_80pct_size_inactive',
    serverScreener: { fundamentalCoveragePct: 90, fmpOk: true },
    rows: SECTORS_3.flatMap((sector, si) => Array.from({ length: 10 }, (_, i) => makeRow(`S${si}R${i}`, sector, si * 10 + i, (si * 10 + i) % 3 === 0 ? {} : { _mcapObservedAt: null })))
  },
  {
    name: 'fundamental_coverage_below_80pct_value_quality_inactive',
    serverScreener: { fundamentalCoveragePct: 42.5, fmpOk: false },
    rows: SECTORS_3.flatMap((sector, si) => Array.from({ length: 10 }, (_, i) => makeRow(`S${si}R${i}`, sector, si * 10 + i)))
  }
  // NaN/missing-field row handling is NOT covered by a fixture here — NaN does not survive a
  // JSON.stringify/parse round trip (it silently becomes null, which is typeof 'object' and would
  // corrupt the very eligibility check this was meant to exercise). That behavior is verified
  // instead as a direct in-memory unit test in scripts/ci-esm-core-unit-check.mjs, which needs no
  // serialization and can assert against genuine NaN/undefined values.
];

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window._aioComputeFactorRanks === 'function', { timeout: 30000 });

  // Capture the REAL SCREENER_DB snapshot FIRST, before any synthetic scenario below overwrites
  // window.SCREENER_DB — capturing it after the loop would silently dump the last synthetic
  // scenario's leftover data instead of real page state.
  const realDump = await page.evaluate(() => {
    window.AIO = window.AIO || {};
    window.AIO.marketState = null;
    const rowsBefore = Array.isArray(window.SCREENER_DB) ? window.SCREENER_DB.map((r) => ({ ...r })) : [];
    const serverScreener = window._aioServerScreener || {};
    const summary = window._aioComputeFactorRanks();
    return {
      rowCount: rowsBefore.length,
      serverScreener,
      summary,
      activeFactorRegime: window._aioActiveFactorRegime,
      activeFactorWeights: window._aioActiveFactorWeights,
      activeFactors: window._aioActiveFactors,
      inactiveFactorReasons: window._aioInactiveFactorReasons,
      rowsBefore,
      rows: Array.isArray(window.SCREENER_DB) ? window.SCREENER_DB.map((r) => {
        const out = { sym: r.sym, _compositeZ: r._compositeZ, factorScores: r.factorScores, rank: r.rank, quantSignal: r.quantSignal };
        (window._aioActiveFactors || []).forEach((key) => { out['_z_' + key] = r['_z_' + key]; });
        return out;
      }) : []
    };
  });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const dumped = await page.evaluate(({ rows, serverScreener }) => {
      window.AIO = window.AIO || {};
      window.AIO.marketState = null;
      window._aioServerScreener = serverScreener;
      window.SCREENER_DB = rows.map((r) => ({ ...r }));
      const summary = window._aioComputeFactorRanks();
      return {
        summary,
        activeFactorRegime: window._aioActiveFactorRegime,
        activeFactorWeights: window._aioActiveFactorWeights,
        activeFactors: window._aioActiveFactors,
        inactiveFactorReasons: window._aioInactiveFactorReasons,
        rows: window.SCREENER_DB.map((r) => {
          const out = { sym: r.sym, _compositeZ: r._compositeZ, factorScores: r.factorScores, rank: r.rank, quantSignal: r.quantSignal };
          (window._aioActiveFactors || []).forEach((key) => { out['_z_' + key] = r['_z_' + key]; });
          return out;
        })
      };
    }, { rows: scenario.rows, serverScreener: scenario.serverScreener });
    fixtures.push({ name: scenario.name, inputs: { rows: scenario.rows, serverScreener: scenario.serverScreener }, legacyOutput: dumped });
  }

  // Real current SCREENER_DB snapshot (Fable recommendation: emergent real-data shape, not just
  // hand-built edge cases), captured before the loop above — see comment there.
  fixtures.push({ name: 'real_screener_db_snapshot', inputs: { rows: realDump.rowsBefore, serverScreener: realDump.serverScreener }, legacyOutput: { summary: realDump.summary, activeFactorRegime: realDump.activeFactorRegime, activeFactorWeights: realDump.activeFactorWeights, activeFactors: realDump.activeFactors, inactiveFactorReasons: realDump.inactiveFactorReasons, rows: realDump.rows } });

  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFunction: 'js/aio-data.js:_aioComputeFactorRanks', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, realRowCount: realDump.rowCount, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
