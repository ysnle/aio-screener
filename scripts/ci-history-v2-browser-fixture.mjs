#!/usr/bin/env node
// v59.70 (integration review 89e8c881): CI's browser shards read the pinned snapshot (architecture/browser-data-fixture.json),
// and its history.json may still be the v1 array while refresh-data already writes history.v2 (field dictionary +
// checkedAt, src/domain/market/indices/history-rows.js). This fixture keeps the page's v2 read path under CI instead of leaving
// it to the watchdog: it serves the working tree's history compacted to history.v2 and checks the page loads the same
// rows a v1 array gives — the boot prefetch in <head>, js/aio-data.js _aioLoadHistory and window.__aioReadHistoryRows.
//   1. v2 served: load state 'ready', same day count, first/last date, expanded fieldMeta and series as the v1 page;
//   2. v1 served: the control (the array is read as it is);
//   3. v2 served with the expander withheld: the load is refused (failed), so 1 cannot pass on a page that skips it.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { closeAll, freePort, startLocalServer } from './lib/browser-gate.mjs';
import { compactHistoryRows, readHistoryRows, HISTORY_SCHEMA_V2 } from '../src/domain/market/indices/history-rows.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };

const stored = JSON.parse(readFileSync(join(root, 'public-data/history.json'), 'utf8'));
const rows = readHistoryRows(stored);
const v2Body = JSON.stringify(compactHistoryRows(rows));
const v1Body = JSON.stringify(rows);
check('v59.70 the working tree history has rows to serve', rows.length > 100, String(rows.length));
check('v59.70 the served v2 body is history.v2', JSON.parse(v2Body).schemaVersion === HISTORY_SCHEMA_V2);

const port = await freePort();
const origin = `http://127.0.0.1:${port}/`;
const server = await startLocalServer(port, { label: 'history-v2-browser' });
let browser;
const SERIES = ['spx', 'vix', 'us10y'];

async function load(label, body, { withholdExpander = false } = {}) {
  const page = await browser.newPage();
  let served = 0;
  if (withholdExpander) {
    await page.addInitScript(() => Object.defineProperty(window, '__aioReadHistoryRows', { configurable: false, get: () => undefined, set: () => {} }));
  }
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(origin)) return route.abort();
    if (new URL(url).pathname.endsWith('/public-data/history.json')) {
      served += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    }
    return route.continue();
  });
  try {
    await page.goto(`${origin}index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => ['ready', 'failed', 'empty'].includes(window.__aioHistoryLoadState), null, { timeout: 30000 });
    const result = await page.evaluate((fields) => {
      const history = window._aioHistory || [];
      const last = history[history.length - 1] || null;
      return {
        state: window.__aioHistoryLoadState,
        meta: window._aioHistoryMeta || null,
        lastFieldMeta: last?.fieldMeta || null,
        series: Object.fromEntries(fields.map((field) => [field, typeof window._aioHistorySeries === 'function' ? window._aioHistorySeries(field, 2) : null]))
      };
    }, SERIES);
    return { label, served, ...result };
  } finally {
    await page.close();
  }
}

try {
  browser = await chromium.launch();
  const v2 = await load('v2', v2Body);
  const v1 = await load('v1', v1Body);
  const withheld = await load('v2 without expander', v2Body, { withholdExpander: true });
  const lastRow = rows[rows.length - 1];

  check('v59.70 the v2 body reached the page (prefetch or loader)', v2.served >= 1, String(v2.served));
  check('v59.70 history.v2 loads: state ready', v2.state === 'ready', v2.state);
  check('v59.70 history.v2 loads every day', v2.meta?.days === rows.length, `${v2.meta?.days} vs ${rows.length}`);
  check('v59.70 history.v2 keeps the first and last date', v2.meta?.first === rows[0]?.date && v2.meta?.last === lastRow?.date, `${v2.meta?.first}..${v2.meta?.last}`);
  check('v59.70 history.v2 rows carry the expanded v1 fieldMeta (checkedAt → fetchedAt, lastSuccessfulAt)', isDeepStrictEqual(v2.lastFieldMeta, lastRow?.fieldMeta ?? null));
  check('v59.70 v1 control loads: state ready, same days', v1.state === 'ready' && v1.meta?.days === rows.length, `${v1.state} ${v1.meta?.days}`);
  for (const field of SERIES) {
    check(`v59.70 the ${field} series reads the same from v1 and v2`, isDeepStrictEqual(v2.series[field], v1.series[field]), `${v2.series[field]?.length} vs ${v1.series[field]?.length}`);
  }
  check('v59.70 at least one series has points (the comparison is not empty against empty)', SERIES.some((field) => Array.isArray(v1.series[field]) && v1.series[field].length > 1));
  check('v59.70 with the expander withheld the v2 load is refused, not read as rows', withheld.state === 'failed', withheld.state);
} finally {
  await closeAll({ browser, server });
}

if (failures.length) {
  console.error(`history v2 browser fixture FAIL (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`history v2 browser fixture OK: ${rows.length} days read the same from history.v2 and v1 in the page (prefetch + _aioLoadHistory + __aioReadHistoryRows); withheld expander refused`);
