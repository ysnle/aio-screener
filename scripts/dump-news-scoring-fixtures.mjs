import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// RM-03 (continued): dumps (scenario items, legacy computeNewsSentimentScore/computeNewsRiskSignals
// output) pairs by driving the REAL, unmodified js/aio-data.js functions inside a real Chromium
// page — the golden fixture the extraction's parity gate compares
// src/domain/news/scoring.js against. MUST be run against the pre-extraction commit (before the
// legacy wrappers were rewritten to call window.AIO_ARCH) — re-run via `git stash` back to that
// state any time the legacy wrapper changes in a way that should not change scoring behavior.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8899);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const OUT_PATH = resolve(root, 'architecture/fixtures/news-scoring-golden.json');
const FIXED_NOW = Date.parse('2026-07-20T03:00:00.000Z'); // KST 12:00 -- inside the 07-20 08:00-KST-anchored cycle

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[dump-news-scoring/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

function iso(hoursAgoFromFixedNow) { return new Date(FIXED_NOW - hoursAgoFromFixedNow * 3600000).toISOString(); }
// Default pubDate sits ~15h before FIXED_NOW: inside both the 24h sentiment lookback and the
// KST-08:00-anchored completed-24h risk-signal window (which for this FIXED_NOW spans roughly
// [now-28h, now-4h)) -- avoids scenario items silently landing just outside either filter.
function item(overrides) { return { title: '', desc: '', topic: 'general', pubDate: iso(15), ...overrides }; }

const SCENARIOS = [
  { name: 'empty_items', items: [] },
  { name: 'all_stale_beyond_24h', items: [item({ title: 'market rally continues', pubDate: iso(30) }), item({ title: 'stocks surge on earnings beat', pubDate: iso(48) })] },
  {
    name: 'strong_bullish_mix',
    items: [
      item({ title: 'Stocks surge to record high on rally', topic: 'equity' }),
      item({ title: 'Tech shares soar after earnings beat', topic: 'earnings' }),
      item({ title: 'Market boom continues as recovery accelerates', topic: 'macro' }),
      item({ title: 'Analysts upgrade outlook after strong recovery', topic: 'analyst' })
    ]
  },
  {
    name: 'strong_bearish_mix_with_geo_and_credit',
    items: [
      item({ title: 'Stocks crash amid trade war fears', topic: 'geo' }),
      item({ title: 'Military conflict escalates, sanctions expand', topic: 'geo' }),
      item({ title: 'Sanctions widen as geopolitical crisis deepens', topic: 'geo' }),
      item({ title: 'Regional conflict spreads, military buildup reported', topic: 'geo' }),
      item({ title: 'Fresh military clash raises trade war concerns', topic: 'geo' }),
      item({ title: 'Credit spread widens amid default fears', topic: 'credit' }),
      item({ title: 'Bond market flags rising default risk', topic: 'credit' }),
      item({ title: 'Analysts warn of credit stress ahead', topic: 'credit' }),
      item({ title: 'Oil crash triggers energy sector sell-off', topic: 'energy' }),
      item({ title: 'Energy prices plunge on demand collapse', topic: 'energy' }),
      item({ title: 'Energy crisis fears mount after supply shock', topic: 'energy' })
    ]
  },
  {
    name: 'earnings_season_positive',
    items: [
      item({ title: 'Company A beats and shares surge on rally', topic: 'earnings' }),
      item({ title: 'Company B soars after earnings beat, upgrade follows', topic: 'earnings' }),
      item({ title: 'Company C outperforms, shares rally and surge', topic: 'earnings' }),
      item({ title: 'Company D rallies and shares surge on earnings beat', topic: 'earnings' }),
      item({ title: 'Company E soars past estimates, upgrade follows', topic: 'earnings' }),
      item({ title: 'Company F misses forecast and shares plunge', topic: 'earnings' })
    ]
  },
  {
    name: 'neutral_mixed_topics',
    items: [
      item({ title: 'Fed holds rates steady as expected', topic: 'macro' }),
      item({ title: 'Quarterly review of semiconductor demand', topic: 'semi' }),
      item({ title: 'Weekly crypto market wrap', topic: 'crypto' }),
      item({ title: 'FX desk notes stable dollar trading', topic: 'fx' })
    ]
  },
  {
    name: 'missing_pubdate_and_desc_fields',
    items: [{ title: 'Untimed wire item mentions rally', topic: 'general' }, { title: 'Second untimed item notes crash', topic: 'general', pubDate: 'not-a-date' }]
  },
  {
    name: 'exactly_at_geo_mid_threshold',
    items: [item({ title: 'Regional tension update one', topic: 'geo' }), item({ title: 'Regional tension update two', topic: 'geo' })]
  }
];

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.addInitScript((fixedNow) => {
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { if (args.length === 0) { super(fixedNow); } else { super(...args); } }
      static now() { return fixedNow; }
    }
    // eslint-disable-next-line no-global-assign
    Date = FixedDate;
  }, FIXED_NOW);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.computeNewsSentimentScore === 'function' && typeof window.computeNewsRiskSignals === 'function', { timeout: 30000 });

  const fixtures = [];
  for (const scenario of SCENARIOS) {
    const output = await page.evaluate(({ items }) => ({
      sentiment: window.computeNewsSentimentScore(items),
      risk: window.computeNewsRiskSignals(items)
    }), { items: scenario.items });
    fixtures.push({ name: scenario.name, items: scenario.items, now: FIXED_NOW, legacyOutput: output });
  }
  if (pageErrors.length) throw new Error(`page errors during fixture dump: ${pageErrors.join(' | ')}`);

  await writeFile(OUT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), fixedNow: FIXED_NOW, sourceFunction: 'js/aio-data.js:computeNewsSentimentScore/computeNewsRiskSignals', fixtures }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, fixtureCount: fixtures.length, out: OUT_PATH }));
} finally {
  await browser.close();
  server.kill();
}
