import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_SCREENER_AUTO_TEST_PORT || 8913);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    child.stdout.on('data', (data) => {
      if (!ready && String(data).includes('AIO local server')) {
        ready = true;
        resolveServer(child);
      }
    });
    child.stderr.on('data', (data) => process.stderr.write(`[screener-auto/server] ${data}`));
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
  // A deterministic runtime fixture; actual artifact age remains owned by the
  // data-lineage gate. The stale state is independently exercised below.
  await page.clock.setFixedTime(new Date(fixtureEpoch));
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/net::ERR_FAILED|Failed to load resource|^\[AIO:api\] [\w-]+: warn .* error/.test(message.text())) runtimeErrors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800, { timeout: 30000 });
  await page.evaluate(() => window.showPage('screener'));
  await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length === 12, { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const visible = [...document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]')]
      .map((node) => node.getAttribute('data-aio-screener-ticker')).filter(Boolean);
    const registered = visible.filter((symbol) => (window._aioQuoteRequestSymbols || []).includes(symbol));
    const observedAt = new Date().toISOString();
    const revision = `ci-visible-quotes:${observedAt}`;
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
        revision,
        changeBasis: 'previous-regular-session-close'
      };
    });
    document.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { source: 'ci-fixture' } }));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    const catalog = window.AIO_ARCH.getRuntimeObservationCatalog();
    const timeline = window.AIO_ARCH.getPageDataTimelineState('screener');
    const state = window.AIO_ARCH.getScreenerState();
    const prices = [...document.querySelectorAll('#screener-results-body td[data-column-key="price"]')].map((node) => node.textContent.trim());
    return {
      visible,
      registered,
      prices,
      visibleQuotes: catalog['screener.visibleQuotes'],
      timeline,
      ranking: state.metadata?.ranking || null
    };
  });

  if (runtimeErrors.length) throw new Error(`runtime errors: ${runtimeErrors.join(' | ')}`);
  if (result.visible.length !== 12 || result.registered.length !== result.visible.length) throw new Error(`visible quote demand ${result.registered.length}/${result.visible.length}`);
  if (result.prices.length !== 12 || result.prices.some((value) => !value || value === '—' || value === '미수신')) throw new Error(`visible prices not rendered: ${JSON.stringify(result.prices)}`);
  if (result.visibleQuotes?.available === false || result.visibleQuotes?.value !== 1 || !result.visibleQuotes?.observedAt) throw new Error(`visible quote coverage invalid: ${JSON.stringify(result.visibleQuotes)}`);
  const requiredFailures = result.timeline.checks.filter((check) => check.required && check.status !== 'PASS');
  if (result.timeline.checks.length !== 6 || requiredFailures.length) throw new Error(`required quant timeline failed: ${JSON.stringify(requiredFailures)}`);
  if (!result.ranking?.available || result.ranking?.inputVersion !== result.timeline.checks.find((check) => check.id === 'screener.snapshot')?.revision) throw new Error(`ranking revision mismatch: ${JSON.stringify(result.ranking)}`);
  if ((result.ranking.activeFactors || []).includes('value') || (result.ranking.activeFactors || []).includes('quality')) throw new Error(`stale fundamentals activated ranking factors: ${JSON.stringify(result.ranking.activeFactors)}`);

  const screenChoices = await page.locator('#scr-screen-select option').evaluateAll(nodes => nodes.map(node => node.value));
  if (screenChoices.length < 2) throw new Error('screen selector fixture requires distinct definitions');
  await page.locator('#scr-screen-select').selectOption(screenChoices[1]);
  const selectedDefinition = JSON.parse(await page.locator('#scr-definition-editor').inputValue()).definition;
  if (selectedDefinition.screenId !== screenChoices[1]) throw new Error('select control did not change the actual definition');
  await page.locator('#scr-screen-select').selectOption(screenChoices[0]);
  const sticky = await page.locator('#screener-results-body td[data-column-key="sym"]').first().evaluate(node => node.style.left);
  if (sticky !== '0px') throw new Error(`single frozen symbol column must start at zero, got ${sticky}`);
  await page.locator('#scr-builder-field').selectOption('rsi');
  await page.locator('#scr-builder-value').fill('55');
  await page.locator('[data-aio-screener-action="add-builder-condition"]').click();
  await page.locator('[data-aio-screener-action="remove-builder-condition"]').first().click();
  if (await page.locator('#scr-rsi-min').inputValue() !== '') throw new Error('removing the condition chip left the filter active');
  await page.locator('[data-aio-screener-action="add-builder-condition"]').click();
  await page.locator('#scr-builder-value').fill('52');
  await page.locator('[data-aio-screener-action="add-builder-condition"]').click();
  if (await page.locator('[data-aio-screener-action="remove-builder-condition"]').count() !== 1) throw new Error('replacing a condition appended a second source of truth');
  await page.locator('[data-aio-screener-action="screen-run-visual"]').click();
  await page.waitForFunction(() => document.getElementById('scr-workbench-status')?.dataset.persistence === 'persisted');
  const recorded = await page.locator('#scr-workbench-status').evaluate(node => ({ ...node.dataset }));
  await page.evaluate(() => {
    const row = window.AIO_ARCH.getScreenerState().rows.find(row => window._liveData?.[row.sym]?.price);
    window._liveData[row.sym].price += 1;
    document.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { source: 'frozen-run-fixture' } }));
  });
  await page.waitForFunction(snapshot => window.AIO_ARCH.getScreenerState().snapshotId !== snapshot, recorded.snapshotId);
  if (await page.locator('#scr-workbench-status').getAttribute('data-result-hash') !== recorded.resultHash) throw new Error('background quote refresh replaced a user-frozen run');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800);
  await page.evaluate(() => window.showPage('screener'));
  await page.getByRole('button', { name: '저장 입력으로 재현', exact: true }).first().click();
  await page.waitForFunction(() => document.getElementById('scr-workbench-status')?.textContent.includes('보관한 입력으로 재현됨'));
  const replayed = await page.locator('#scr-workbench-status').evaluate(node => ({ resultHash: node.dataset.resultHash, explanationsHash: node.dataset.explanationsHash, rows: Number(node.dataset.rowCount) }));
  if (replayed.resultHash !== recorded.resultHash || replayed.explanationsHash !== recorded.explanationsHash || replayed.rows < 800) throw new Error('persisted replay changed inputs/results after reload');
  await page.getByRole('button', { name: '보관 삭제', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('scr-run-history')?.textContent.includes('보관한 사용자 실행 없음'));
  await page.clock.setFixedTime(new Date(fixtureEpoch + 10 * 86400000));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('aio:refresh:done', { detail: { source: 'stale-fixture' } })));
  await page.waitForFunction(() => {
    const state = window.AIO_ARCH?.getScreenerState?.();
    return state?.metadata?.factorFreshnessStatus === 'stale' && state.rows.length >= 800 && state.metadata?.ranking?.available === false;
  });
  if (runtimeErrors.length) throw new Error(`runtime errors after replay: ${runtimeErrors.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    visibleRows: result.visible.length,
    registeredQuotes: result.registered.length,
    quoteCoverage: result.visibleQuotes.value,
    timelineStatus: result.timeline.status,
    requiredPasses: result.timeline.checks.filter((check) => check.required && check.status === 'PASS').length,
    activeFactors: result.ranking.activeFactors,
    optionalUnavailable: result.timeline.optionalUnavailable,
    persistedReplay: replayed,
    frozenRunSurvivesQuoteRefresh: true,
    staleRowsPreservedWithCalculationBlocked: true,
    runtimeErrors: 0
  }));
} finally {
  await browser.close();
  server.kill();
}
