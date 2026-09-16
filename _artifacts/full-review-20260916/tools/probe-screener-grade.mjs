import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankGrade, visibleRank } from '../../../src/ui/pages/screener.js';

// Pure-function check first: this is the exact path the fix changed. A rejected or
// unavailable row keeps its raw rank, so the grade must not be derived from it.
const pureCases = [
  [{ screenStatus: 'rejected', rank: 99 }, null, '—', 'rejected row keeps a raw rank but must not show a grade'],
  [{ screenStatus: 'unavailable', rank: 88 }, null, '—', 'unavailable row must not show a grade'],
  [{ screenStatus: 'passed', rank: 99 }, 99, 'A', 'passed top rank grades A'],
  [{ screenStatus: 'passed', rank: 65 }, 65, 'B', '65 is the B boundary'],
  [{ screenStatus: 'passed', rank: 50 }, 50, 'C', '50 is the C boundary'],
  [{ screenStatus: 'passed', rank: 35 }, 35, 'D', '35 is the D boundary']
];
let pureFailures = 0;
for (const [row, expectedRank, expectedGrade, label] of pureCases) {
  const gotRank = visibleRank(row);
  const gotGrade = rankGrade(gotRank) || '—';
  const ok = gotRank === expectedRank && gotGrade === expectedGrade;
  if (!ok) pureFailures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: visibleRank=${gotRank} grade=${gotGrade} (expected ${expectedRank}/${expectedGrade})`);
}
// The filter labels must be derived from the same grade function.
const labelFailures = [40, 50, 65, 80].filter((threshold) => rankGrade(threshold) !== { 40: 'D', 50: 'C', 65: 'B', 80: 'A' }[threshold]);
console.log(`rankGrade filter-label mapping mismatches: ${labelFailures.join(',') || 'none'}`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const port = Number(process.env.AIO_GRADE_PROBE_PORT || 8918);

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
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800, { timeout: 30000 });
  await page.evaluate(() => window.showPage('screener'));
  await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length > 0, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#screener-results-body tr[data-aio-screener-ticker]')];
    const cells = (tr) => ({
      ticker: tr.getAttribute('data-aio-screener-ticker'),
      rank: tr.querySelector('td[data-column-key="rank"]')?.textContent.trim() ?? null,
      grade: tr.querySelector('td[data-column-key="grade"]')?.textContent.trim() ?? null,
      why: tr.getAttribute('data-aio-screener-why')
    });
    const observed = rows.map(cells).filter((row) => row.rank !== null || row.grade !== null);
    const violations = observed.filter((row) => row.grade && row.grade !== '—' && (row.rank === '—' || /조건 미충족/.test(row.rank || '')));
    const select = document.getElementById('scr-min-rank');
    return {
      renderedRows: observed.length,
      rowsWithGradeCells: observed.filter((row) => row.grade !== null).length,
      rankFilterOptions: select ? [...select.options].map((option) => `${option.value}:${option.textContent}`) : null,
      violations,
      sample: observed.slice(0, 6)
    };
  });
  console.log(JSON.stringify(result, null, 1));
  if (result.violations.length) {
    console.error(`FAIL: ${result.violations.length} row(s) show a grade while the rank cell denies one`);
    process.exitCode = 1;
  }
  if (pureFailures || labelFailures.length) {
    console.error(`FAIL: pure grade checks failed (${pureFailures}) or label mapping drifted (${labelFailures.join(',')})`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.kill();
}
