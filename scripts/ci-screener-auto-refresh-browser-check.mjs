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
  await page.locator('#scr-tab-button-evidence').click();
  await page.waitForFunction(() => document.getElementById('scr-tab-evidence')?.hidden === false, { timeout: 5000 });
  const conditionalEvidencePanel = await page.locator('#screener-conditional-evidence-panel').evaluate((node) => ({ status: node.dataset.statusCode, text: node.textContent }));
  if (conditionalEvidencePanel.status !== 'NO_CONDITIONAL_EVIDENCE' || /keygen|password|download/i.test(conditionalEvidencePanel.text)) throw new Error(`conditional evidence fail-closed contract invalid: ${JSON.stringify(conditionalEvidencePanel)}`);
  await page.locator('#scr-tab-button-ranking').click();

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
  // P1165 (19 스크리너 작업 카드 / 12 U01): 실행 전 미리보기는 **선택한 정의**로 계산되고 그 정의의
  // 내장 조건이 표시되어야 한다. 파이프라인 기본(native-screener-workbench) 수치를 선택한 정의의
  // 결과로 읽히게 두지 않으며, 미리보기는 보관 실행을 남기지 않는다(부작용 금지).
  const readPreviewUi = () => {
    const note = document.getElementById('screener-readiness-note') || {};
    return {
      title: note.title || '',
      status: document.getElementById('scr-workbench-status')?.textContent || '',
      history: document.getElementById('scr-run-history')?.textContent || '',
      funnel: ['universe', 'ready', 'passed', 'unavailable'].map((key) => document.getElementById(`scr-funnel-${key}`)?.textContent).join('/')
    };
  };
  const historyBeforeSweep = await page.evaluate(() => document.getElementById('scr-run-history')?.textContent || '');
  const sweepIds = screenChoices.slice(0, 3);
  const previewSweep = [];
  for (const screenId of sweepIds) {
    await page.locator('#scr-screen-select').selectOption(screenId);
    await page.waitForFunction((id) => (document.getElementById('screener-readiness-note')?.textContent || '').includes(id), screenId);
    previewSweep.push(await page.evaluate(readPreviewUi));
  }
  if (new Set(previewSweep.map((entry) => entry.title)).size !== previewSweep.length) throw new Error(`P1165 preview did not follow the selected definition: ${JSON.stringify(previewSweep.map((entry) => entry.title))}`);
  if (previewSweep.some((entry) => !/내장 조건: .+/.test(entry.title))) throw new Error(`P1165 built-in preset conditions were not surfaced: ${JSON.stringify(previewSweep.map((entry) => entry.title))}`);
  if (previewSweep.some((entry, index) => !entry.status.includes(sweepIds[index]) || entry.status.includes('native-screener-workbench'))) throw new Error(`P1165 pre-run status must cite the selected definition, not the pipeline default: ${JSON.stringify(previewSweep.map((entry) => entry.status))}`);
  if (previewSweep.some((entry) => entry.history !== historyBeforeSweep)) throw new Error('P1165 preview must not record a run');
  await page.locator('#scr-screen-select').selectOption(screenChoices[0]);

  // P1167 (15 D04/D05): 일봉 timestamp는 그 세션 바의 시작이며 종가 기반 팩터의 관측시각이 아니다.
  // 정적 유니버스가 MIC·assetType을 발행하지 않으면 그 미확인이 행과 화면에 남아야 한다.
  const timeAndIdentity = await page.evaluate(() => {
    const rows = window.AIO_ARCH.getScreenerState().rows;
    const gaps = rows.filter((row) => row.identityValidation && row.identityValidation.ok === false);
    return {
      rows: rows.length,
      gapCount: gaps.length,
      gapFields: [...new Set(gaps.flatMap((row) => row.identityValidation.missing || []))],
      marketSource: gaps[0]?.identityValidation?.marketSource || null,
      mic: gaps[0]?.instrumentRef?.mic ?? null,
      assetType: gaps[0]?.instrumentRef?.assetType ?? null,
      provenance: document.querySelector('[data-screener-provenance]')?.textContent || '',
      provenanceTitle: document.querySelector('[data-screener-provenance]')?.title || '',
      factorAsOf: document.querySelector('[data-factor-asof]')?.textContent || '',
      readiness: document.getElementById('screener-readiness-note')?.textContent || ''
    };
  });
  if (timeAndIdentity.rows < 800) throw new Error(`P1167 identity fixture requires the published universe, got ${timeAndIdentity.rows}`);
  if (timeAndIdentity.gapCount !== timeAndIdentity.rows) throw new Error(`P1167 unverified identity metadata must be published per row, got ${timeAndIdentity.gapCount}/${timeAndIdentity.rows}`);
  if (!timeAndIdentity.gapFields.includes('mic_missing') || !timeAndIdentity.gapFields.includes('asset_type_missing')) throw new Error(`P1167 the missing identity fields must be named: ${JSON.stringify(timeAndIdentity.gapFields)}`);
  if (timeAndIdentity.marketSource !== 'symbol-suffix-inference') throw new Error(`P1167 an inferred market must stay marked as inferred: ${timeAndIdentity.marketSource}`);
  if (timeAndIdentity.mic != null || timeAndIdentity.assetType != null) throw new Error('P1167 the provider must not invent MIC/assetType to satisfy the validator');
  if (!/가격 조회 성공은 식별 확인이 아닙니다/.test(timeAndIdentity.readiness)) throw new Error('P1167 the surface must separate a successful quote from verified identity');
  if (!/바 시작 .*관측시각 아님/.test(timeAndIdentity.provenance) || !/세션 종가 기준/.test(timeAndIdentity.provenance)) throw new Error(`P1167 a daily bar timestamp must not be presented as the factor observation time: ${timeAndIdentity.provenance.slice(0, 200)}`);
  if (!/관측시각이 아닙니다/.test(timeAndIdentity.provenanceTitle)) throw new Error('P1167 the time-basis explanation must survive the coverage-scope title');

  // P1168 (13 잔여·SCR-UX-07): the published run history is the producer's pipeline baseline, not a
  // user execution. A route re-entry must not accumulate identical baseline runs, and a machine run
  // must not be published as if a user had executed it.
  const runHistoryLens = () => window.AIO_ARCH.getScreenerState().runHistory.map((run) => `${run.origin || 'untagged'}|${run.resultHash || 'no-hash'}`);
  const historyBeforeReentry = await page.evaluate(runHistoryLens);
  for (let lap = 0; lap < 2; lap += 1) {
    await page.evaluate(() => window.showPage('home'));
    await page.waitForFunction(() => document.getElementById('page-screener')?.dataset.aioArchitectureRoute === 'screener' || document.getElementById('page-home'));
    await page.evaluate(() => window.showPage('screener'));
    await page.waitForFunction(() => document.querySelectorAll('#screener-results-body [data-aio-screener-ticker]').length === 12);
  }
  const historyAfterReentry = await page.evaluate(runHistoryLens);
  if (historyAfterReentry.length > historyBeforeReentry.length) throw new Error(`P1168 screener re-entry accumulated identical pipeline runs: ${historyBeforeReentry.length} -> ${historyAfterReentry.length}`);
  if (historyAfterReentry.some((entry) => entry.startsWith('untagged|'))) throw new Error(`P1168 machine runs must be tagged in the run history: ${JSON.stringify(historyAfterReentry)}`);
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
  // A quote tick is view-layer evidence: it must refresh visible prices without
  // minting a new ranked snapshot or replacing a user-frozen run. Screener state
  // is deliberately re-synced on `aio:refresh:done` (src/app/bootstrap.js), not on
  // quote ticks, so immutability under quote churn is the contract the design
  // actually offers. Asserting "a tick must mint a new snapshotId" encoded the
  // pre-overlay design and can no longer hold (P1074).
  const afterQuoteTick = await page.evaluate(async () => {
    const row = window.AIO_ARCH.getScreenerState().rows.find(row => window._liveData?.[row.sym]?.price);
    window._liveData[row.sym].price += 1;
    document.dispatchEvent(new CustomEvent('aio:liveQuotes', { detail: { source: 'frozen-run-fixture' } }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const status = document.getElementById('scr-workbench-status');
    return {
      snapshotId: window.AIO_ARCH.getScreenerState().snapshotId,
      resultHash: status?.getAttribute('data-result-hash'),
      prices: [...document.querySelectorAll('#screener-results-body td[data-column-key="price"]')].map((node) => node.textContent.trim())
    };
  });
  if (afterQuoteTick.snapshotId !== recorded.snapshotId) throw new Error('background quote tick replaced the ranked snapshot');
  if (afterQuoteTick.resultHash !== recorded.resultHash) throw new Error('background quote refresh replaced a user-frozen run');
  if (afterQuoteTick.prices.some((value) => !value || value === '미수신')) throw new Error(`price column lost its live overlay after a quote tick: ${JSON.stringify(afterQuoteTick.prices)}`);
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
    conditionalEvidenceStatus: conditionalEvidencePanel.status,
    frozenRunSurvivesQuoteRefresh: true,
    staleRowsPreservedWithCalculationBlocked: true,
    runtimeErrors: 0
  }));
} finally {
  await browser.close();
  server.kill();
}
