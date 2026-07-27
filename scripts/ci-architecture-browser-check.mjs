import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ARCH_TEST_PORT || 8897);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[architecture-browser/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early: ${code}`)); });
    setTimeout(readyOnce, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // RM-05: the 17-route round trip visits routes (macro/fxbond/etc.) the original smaller test
    // sequence never reached, each with their own [AIO:api] health tracker that escalates
    // warn→error after enough blocked-network attempts — expected and harmless offline, matching
    // the existing proxy-primary allowance generalized to any tracked API name.
    if (message.type() === 'error' && !/net::ERR_FAILED/.test(message.text()) && !/^\[AIO:api\] [\w-]+: warn → error/.test(message.text())) errors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.showPage === 'function', { timeout: 30000 });
  } catch (error) {
    console.error(JSON.stringify({ waitError: error.message, errors, runtime: await page.evaluate(() => ({ arch: typeof window.AIO_ARCH, showPage: typeof window.showPage, readyState: document.readyState, scripts: [...document.scripts].map((script) => script.src || 'inline').slice(-8) })) }));
    throw error;
  }

  const boot = await page.evaluate(() => ({
    status: window.AIO_ARCH.status,
    navigationInstalled: window.showPage?.__aioArchitectureNavigation === true,
    hasNavigate: typeof window.AIO_ARCH.navigate === 'function',
    summaryBlocked: window.AIO_ARCH.getSentimentSummary().blocked,
    state: window.AIO_ARCH.getState()
  }));
  if (boot.status !== 'MIGRATION_IN_PROGRESS') throw new Error(`unexpected architecture status: ${boot.status}`);
  if (!boot.navigationInstalled || !boot.hasNavigate) throw new Error(`typed navigation facade not installed: ${JSON.stringify(boot)}`);
  if (!boot.summaryBlocked) throw new Error('offline sentiment must remain blocked');
  await page.waitForFunction(() => {
    const el = document.getElementById('live-quote-ts-topbar');
    return el?.textContent?.includes('기준 시세');
  }, { timeout: 15000 });
  const quoteTopbar = await page.evaluate(() => {
    const el = document.getElementById('live-quote-ts-topbar');
    return {
      text: el?.textContent || '',
      className: el?.className || '',
      title: el?.getAttribute('title') || ''
    };
  });
  if (!/기준 시세.+\(16개\)/.test(quoteTopbar.text) || !/\bfb-static\b/.test(quoteTopbar.className) || !/실시간 시세가 아닌/.test(quoteTopbar.title)) {
    throw new Error(`snapshot quote topbar must stay reference-only while external providers are blocked: ${JSON.stringify(quoteTopbar)}`);
  }

  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  const sentimentRoute = await page.evaluate(() => ({
    active: window.AIO_ARCH.router.active(),
    storeRoute: window.AIO_ARCH.getState().route,
    state: document.getElementById('sent-overall-badge')?.dataset.aioArchitectureState,
    renderer: document.getElementById('page-sentiment')?.dataset.aioArchitectureRenderer,
    evidenceId: document.getElementById('sent-overall-badge')?.dataset.aioEvidenceId || null,
    badgeText: document.getElementById('sent-overall-badge')?.textContent || ''
  }));
  if (sentimentRoute.active !== 'sentiment' || sentimentRoute.storeRoute !== 'sentiment' || sentimentRoute.state !== 'blocked' || sentimentRoute.renderer !== 'native' || sentimentRoute.badgeText !== '심리: 판정 보류') throw new Error(`sentiment lifecycle failed: ${JSON.stringify(sentimentRoute)}`);

  await page.evaluate(() => window.AIO_ARCH.navigate('guide'));
  await page.waitForFunction(() => document.getElementById('page-guide')?.dataset.aioArchitectureRoute === 'guide');
  const guideRoute = await page.evaluate(() => {
    const input = document.getElementById('guide-search-input');
    input.value = 'VCP';
    document.querySelector('[data-action="_aioGuideSearchTrigger"]')?.click();
    const result = document.getElementById('guide-search-result');
    return {
      active: window.AIO_ARCH.router.active(),
      renderer: document.getElementById('page-guide')?.dataset.aioArchitectureRenderer,
      visible: result?.style.display === 'block',
      resultButtons: result?.querySelectorAll('button[data-guide-target]').length || 0
    };
  });
  if (guideRoute.active !== 'guide' || guideRoute.renderer !== 'native' || !guideRoute.visible || guideRoute.resultButtons < 1) throw new Error(`guide lifecycle/search failed: ${JSON.stringify(guideRoute)}`);

  await page.evaluate(() => window.AIO_ARCH.navigate('market-news'));
  await page.waitForFunction(() => document.getElementById('page-market-news')?.dataset.aioArchitectureRoute === 'market-news');
  const marketRoute = await page.evaluate(() => ({
    renderer: document.getElementById('page-market-news')?.dataset.aioArchitectureRenderer || null,
    feedRenderer: document.getElementById('live-news-feed')?.dataset.aioNewsRenderer || null
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('macro'));
  await page.waitForFunction(() => document.getElementById('page-macro')?.dataset.aioArchitectureRoute === 'macro');
  const macroRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-macro'),
    renderer: document.getElementById('page-macro')?.dataset.aioArchitectureRenderer || null,
    macroRenderer: document.getElementById('page-macro')?.dataset.aioMacroRenderer || null,
    rawLiveSinkCount: document.querySelectorAll('#page-macro [data-live-price], #page-macro [data-live-chg]').length,
    rawSnapSinkCount: document.querySelectorAll('#page-macro [data-snap]').length,
    nativeLiveSinkCount: document.querySelectorAll('#page-macro[data-aio-architecture-renderer="native"] [data-live-price], #page-macro[data-aio-architecture-renderer="native"] [data-live-chg]').length,
    primarySnapSinkCount: document.querySelectorAll('#page-macro[data-aio-architecture-renderer="native"] [data-snap]').length,
    twoYearRenderer: document.getElementById('macro-2y-value')?.dataset.aioMacroTwoYearRenderer || null,
    twoYearValue: document.getElementById('macro-2y-value')?.textContent || '',
    spreadRenderer: document.getElementById('macro-spread-value')?.dataset.aioMacroSpreadRenderer || null,
    spreadValue: document.getElementById('macro-spread-value')?.textContent || '',
    spreadMeaning: document.getElementById('macro-spread-meaning')?.textContent || '',
    spreadStatusRenderer: document.getElementById('spread-status')?.dataset.aioMacroSpreadRenderer || null,
    curveRenderer: document.getElementById('curve-status')?.dataset.aioMacroCurveRenderer || null,
    curveStatus: document.getElementById('curve-status')?.textContent || '',
    curveMeaning: document.getElementById('curve-meaning')?.textContent || '',
    fedMeaningRenderer: document.getElementById('macro-fed-meaning')?.dataset.aioMacroFedMeaningRenderer || null,
    fedMeaningText: document.getElementById('macro-fed-meaning')?.textContent || '',
    htmlHasLiveAttr: document.getElementById('page-macro')?.innerHTML.includes('data-live-price') || false
  }));
  if (macroRoute.twoYearRenderer !== 'native' || !macroRoute.twoYearValue.trim() || macroRoute.spreadRenderer !== 'native' || macroRoute.spreadStatusRenderer !== 'native' || !macroRoute.spreadValue.trim() || !macroRoute.spreadMeaning.trim() || macroRoute.curveRenderer !== 'native' || !macroRoute.curveStatus.trim() || !macroRoute.curveMeaning.trim() || macroRoute.fedMeaningRenderer !== 'native' || !macroRoute.fedMeaningText.trim()) throw new Error(`macro secondary surface failed: ${JSON.stringify(macroRoute)}`);

  await page.evaluate(() => window.AIO_ARCH.navigate('fxbond'));
  await page.waitForFunction(() => document.getElementById('page-fxbond')?.dataset.aioArchitectureRoute === 'fxbond');
  const fxbondRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-fxbond'),
    renderer: document.getElementById('page-fxbond')?.dataset.aioArchitectureRenderer || null,
    fxbondRenderer: document.getElementById('page-fxbond')?.dataset.aioFxbondRenderer || null,
    riskRenderer: document.getElementById('fxbond-risk-pill')?.dataset.aioFxbondRiskRenderer || null,
    riskText: document.getElementById('fxbond-risk-pill')?.textContent || '',
    curveRenderer: document.getElementById('yc-inversion-badge')?.dataset.aioFxbondCurveRenderer || null,
    curveText: document.getElementById('yc-inversion-badge')?.textContent || '',
    carryRenderer: document.getElementById('carry-risk-level')?.dataset.aioFxbondCarryRenderer || null,
    carryText: document.getElementById('carry-risk-level')?.textContent || '',
    carryScoreRenderer: document.getElementById('carry-score-text')?.dataset.aioFxbondCarryScoreRenderer || null,
    carryScoreText: document.getElementById('carry-score-text')?.textContent || '',
    carryScoreBar: document.getElementById('carry-score-bar')?.style.width || '',
    carryVerdict: document.getElementById('carry-verdict')?.textContent || '',
    camRenderer: document.getElementById('cam-verdict-text')?.dataset.aioFxbondCamRenderer || null,
    camText: document.getElementById('cam-verdict-text')?.textContent || '',
    curveStatusRenderer: document.getElementById('yc-chart-status')?.dataset.aioFxbondCurveStatusRenderer || null,
    curveStatusText: document.getElementById('yc-chart-status')?.textContent || '',
    twoYearRenderer: document.getElementById('yc-2y-track')?.dataset.aioFxbondTwoYearRenderer || null,
    twoYearText: document.getElementById('yc-2y-track')?.textContent || '',
    rawLiveSinkCount: document.querySelectorAll('#page-fxbond [data-live-price], #page-fxbond [data-live-chg]').length,
    nativeLiveSinkCount: document.querySelectorAll('#page-fxbond[data-aio-architecture-renderer="native"] [data-live-price], #page-fxbond[data-aio-architecture-renderer="native"] [data-live-chg]').length,
    rawMoveSinkCount: document.querySelectorAll('#page-fxbond [data-snap="move"]').length,
    nativeMoveSinkCount: document.querySelectorAll('#page-fxbond[data-aio-architecture-renderer="native"] [data-snap="move"]').length,
    nativeChartMarkers: ['fxbond-tnx-trend', 'fxbond-jpy-trend', 'koreaCurveChart'].map((id) => document.getElementById(id)?.dataset.aioFxbondChartRenderer || null),
    chartKinds: ['fxbond-tnx-trend', 'fxbond-jpy-trend', 'koreaCurveChart'].map((id) => document.getElementById(id)?.getAttribute('data-source-kind') || null),
    chartStatusTexts: ['fxbond-tnx-trend-status', 'fxbond-jpy-trend-status', 'korea-curve-chart-status'].map((id) => document.getElementById(id)?.textContent || '')
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('breadth'));
  await page.waitForFunction(() => document.getElementById('page-breadth')?.dataset.aioArchitectureRoute === 'breadth');
  const breadthRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-breadth'),
    renderer: document.getElementById('page-breadth')?.dataset.aioArchitectureRenderer || null,
    breadthRenderer: document.getElementById('page-breadth')?.dataset.aioBreadthRenderer || null,
    signalRenderer: document.getElementById('breadth-signal-val')?.dataset.aioBreadthSignalRenderer || null,
    signalText: document.getElementById('breadth-signal-val')?.textContent || '',
    diagnosticRenderer: document.getElementById('breadth-diag-text')?.dataset.aioBreadthDiagnosticRenderer || null,
    diagnosticSignal: document.getElementById('breadth-diag-signal')?.textContent || '',
    diagnosticText: document.getElementById('breadth-diag-text')?.textContent || '',
    stageRenderer: document.getElementById('breadth-stage-summary')?.dataset.aioBreadthStageRenderer || null,
    stageText: document.getElementById('breadth-stage-summary')?.textContent || '',
    mcclellanRenderer: document.getElementById('breadth-mcclellan-summary')?.dataset.aioBreadthMcclellanRenderer || null,
    mcclellanText: document.getElementById('breadth-mcclellan-summary')?.textContent || '',
    nativeChartMarkers: ['bp-price-chart', 'bp-ad-ratio-chart', 'bp-5ma-chart', 'bp-20ma-chart', 'bp-50ma-chart'].map((id) => document.getElementById(id)?.dataset.aioBreadthChartRenderer || null),
    chartKinds: ['bp-price-chart', 'bp-ad-ratio-chart', 'bp-5ma-chart', 'bp-20ma-chart', 'bp-50ma-chart'].map((id) => document.getElementById(id)?.getAttribute('data-source-kind') || null),
    rawPrimarySinkCount: document.querySelectorAll('#page-breadth [data-snap="breadth-5sma"], #page-breadth [data-snap="breadth-20sma"], #page-breadth [data-snap="breadth-50sma"], #page-breadth #breadth-advance-ratio').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-breadth[data-aio-architecture-renderer="native"] [data-snap="breadth-5sma"], #page-breadth[data-aio-architecture-renderer="native"] [data-snap="breadth-20sma"], #page-breadth[data-aio-architecture-renderer="native"] [data-snap="breadth-50sma"], #page-breadth[data-aio-architecture-renderer="native"] #breadth-advance-ratio').length,
    primaryValues: ['breadth-5sma-big', 'breadth-20sma-big', 'breadth-50sma-big', 'breadth-advance-ratio'].map((id) => document.getElementById(id)?.textContent || null)
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('themes'));
  await page.waitForFunction(() => document.getElementById('page-themes')?.dataset.aioArchitectureRoute === 'themes');
  const themesRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-themes'),
    renderer: document.getElementById('page-themes')?.dataset.aioArchitectureRenderer || null,
    themesRenderer: document.getElementById('rrg-quadrant-cards')?.dataset.aioThemesRenderer || null,
    rrgStatusRenderer: document.getElementById('rrg-chart-status')?.dataset.aioRrgStatusRenderer || null,
    rrgStatusText: document.getElementById('rrg-chart-status')?.textContent || '',
    rrgChartRenderer: document.getElementById('rrg-canvas')?.dataset.aioRrgChartRenderer || null,
    rrgCanvasSize: [document.getElementById('rrg-canvas')?.width || 0, document.getElementById('rrg-canvas')?.height || 0],
    cycleRenderer: document.getElementById('theme-cycle-pill')?.dataset.aioThemeCycleRenderer || null,
    cycleText: document.getElementById('theme-cycle-pill')?.textContent || '',
    performanceNarrativeRenderer: document.getElementById('sector-perf-analysis')?.dataset.aioThemePerformanceRenderer || null,
    performanceNarrativeText: document.getElementById('sector-perf-analysis')?.textContent || '',
    rawPrimarySinkCount: document.querySelectorAll('#page-themes #rrg-quadrant-cards, #page-themes #rrg-rotation-read').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-themes[data-aio-architecture-renderer="native"] #rrg-quadrant-cards[data-aio-themes-renderer="native"], #page-themes[data-aio-architecture-renderer="native"] #rrg-rotation-read').length,
    quadrantCount: document.querySelectorAll('#page-themes #rrg-quadrant-cards [data-theme-quadrant]').length
  }));
  await page.evaluate(() => window.showThemeDetail?.(window.THEME_MAP?.[0]?.id || 'defense'));
  const themeDetailInvocation = await page.evaluate(() => ({
    showThemeDetailType: typeof window.showThemeDetail,
    themeMapFirst: window.THEME_MAP?.[0]?.id || null,
    panelDisplay: document.getElementById('theme-detail-panel')?.style.display || null,
    panelRenderer: document.getElementById('theme-detail-panel')?.dataset.aioThemeDetailPanelRenderer || null,
    hostHidden: document.getElementById('theme-detail-native-summary')?.hidden ?? null,
    stateSelectedId: window.AIO_ARCH?.getState?.()?.themes?.selectedId || null,
    stateDetail: window.AIO_ARCH?.getState?.()?.themes?.selectedDetail || null
  }));
  if (themesRoute.renderer !== 'native' || themesRoute.themesRenderer !== 'native' || themesRoute.rrgStatusRenderer !== 'native' || !themesRoute.rrgStatusText.trim() || themesRoute.rrgChartRenderer !== 'native' || themesRoute.rrgCanvasSize[0] < 300 || themesRoute.rrgCanvasSize[1] < 180 || themesRoute.cycleRenderer !== 'native' || !themesRoute.cycleText.trim() || themesRoute.performanceNarrativeRenderer !== 'native' || !themesRoute.performanceNarrativeText.trim() || themesRoute.nativePrimarySinkCount !== themesRoute.rawPrimarySinkCount) throw new Error(`themes native primary/chart/status/cycle/narrative boundary failed: ${JSON.stringify(themesRoute)}`);
  if (themeDetailInvocation.showThemeDetailType !== 'function') throw new Error(`theme-detail invocation unavailable: ${JSON.stringify(themeDetailInvocation)}`);
  if (themeDetailInvocation.panelDisplay !== 'block' || themeDetailInvocation.panelRenderer !== 'native') throw new Error(`theme-detail native panel state did not open: ${JSON.stringify(themeDetailInvocation)}`);
  if (themeDetailInvocation.hostHidden !== false) throw new Error(`theme-detail native summary did not open: ${JSON.stringify(themeDetailInvocation)}`);
  await page.waitForFunction(() => {
    const host = document.getElementById('theme-detail-native-summary');
    return host && !host.hidden && host.textContent.trim().length > 0;
  });
  const themeDetailRoute = await page.evaluate(() => ({
    panelExists: !!document.getElementById('theme-detail-panel'),
    panelRenderer: document.getElementById('theme-detail-panel')?.dataset.aioThemeDetailPanelRenderer || null,
    panelDisplay: document.getElementById('theme-detail-panel')?.style.display || null,
    nativeSummaryExists: !!document.getElementById('theme-detail-native-summary'),
    nativeSummaryHidden: document.getElementById('theme-detail-native-summary')?.hidden ?? true,
    nativeSummaryText: document.getElementById('theme-detail-native-summary')?.textContent || '',
    nativeCompositionExists: !!document.getElementById('theme-detail-native-composition'),
    nativeCompositionHidden: document.getElementById('theme-detail-native-composition')?.hidden ?? true,
    nativeCompositionText: document.getElementById('theme-detail-native-composition')?.textContent || '',
    nativeLeadersExists: !!document.getElementById('theme-detail-native-leaders'),
    nativeLeadersHidden: document.getElementById('theme-detail-native-leaders')?.hidden ?? true,
    nativeLeaderCardCount: document.querySelectorAll('#theme-detail-native-leaders [data-action="showTicker"]').length,
    nativeTemperatureExists: !!document.getElementById('theme-detail-native-temperature'),
    nativeTemperatureHidden: document.getElementById('theme-detail-native-temperature')?.hidden ?? true,
    nativeTemperatureText: document.getElementById('theme-detail-native-temperature')?.textContent || '',
    nativeSpreadExists: !!document.getElementById('theme-detail-native-spread'),
    nativeSpreadHidden: document.getElementById('theme-detail-native-spread')?.hidden ?? true,
    nativeSpreadText: document.getElementById('theme-detail-native-spread')?.textContent || '',
    nativeBreadthHealthExists: !!document.getElementById('theme-detail-native-breadth-health'),
    nativeBreadthHealthHidden: document.getElementById('theme-detail-native-breadth-health')?.hidden ?? true,
    nativeBreadthHealthText: document.getElementById('theme-detail-native-breadth-health')?.textContent || '',
    nativeSubthemeGapExists: !!document.getElementById('theme-detail-native-subtheme-gap'),
    nativeSubthemeGapHidden: document.getElementById('theme-detail-native-subtheme-gap')?.hidden ?? true,
    nativeSubthemeGapText: document.getElementById('theme-detail-native-subtheme-gap')?.textContent || '',
    nativeBenchmarkExists: !!document.getElementById('theme-detail-native-benchmark'),
    nativeBenchmarkHidden: document.getElementById('theme-detail-native-benchmark')?.hidden ?? true,
    nativeBenchmarkText: document.getElementById('theme-detail-native-benchmark')?.textContent || '',
    nativeInsightsExists: !!document.getElementById('theme-detail-native-insights'),
    nativeInsightsHidden: document.getElementById('theme-detail-native-insights')?.hidden ?? true,
    nativeInsightsText: document.getElementById('theme-detail-native-insights')?.textContent || '',
    legacyContentExists: !!document.getElementById('theme-detail-legacy-content'),
    legacyContentEmpty: (document.getElementById('theme-detail-legacy-content')?.textContent || '').trim().length === 0,
    renderer: document.getElementById('page-themes')?.dataset.aioArchitectureRenderer || null
  }));
  if (!themeDetailRoute.panelExists || themeDetailRoute.panelRenderer !== 'native' || themeDetailRoute.panelDisplay !== 'block' || !themeDetailRoute.nativeSummaryExists || themeDetailRoute.nativeSummaryHidden || !themeDetailRoute.nativeCompositionExists || themeDetailRoute.nativeCompositionHidden || !themeDetailRoute.nativeCompositionText.trim() || !themeDetailRoute.nativeLeadersExists || themeDetailRoute.nativeLeadersHidden || themeDetailRoute.nativeLeaderCardCount < 1 || !themeDetailRoute.nativeTemperatureExists || themeDetailRoute.nativeTemperatureHidden || !themeDetailRoute.nativeTemperatureText.trim() || !themeDetailRoute.nativeSpreadExists || themeDetailRoute.nativeSpreadHidden || !themeDetailRoute.nativeSpreadText.trim() || !themeDetailRoute.nativeBreadthHealthExists || themeDetailRoute.nativeBreadthHealthHidden || !themeDetailRoute.nativeBreadthHealthText.trim() || !themeDetailRoute.nativeSubthemeGapExists || themeDetailRoute.nativeSubthemeGapHidden || !themeDetailRoute.nativeSubthemeGapText.trim() || !themeDetailRoute.nativeBenchmarkExists || themeDetailRoute.nativeBenchmarkHidden || !themeDetailRoute.nativeBenchmarkText.trim() || !themeDetailRoute.nativeInsightsExists || themeDetailRoute.nativeInsightsHidden || !themeDetailRoute.nativeInsightsText.trim() || !themeDetailRoute.legacyContentExists || !themeDetailRoute.legacyContentEmpty || themeDetailRoute.renderer !== 'native') throw new Error(`theme-detail native panel/summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap/benchmark/insights/retired-legacy boundary failed: ${JSON.stringify(themeDetailRoute)}`);
  await page.evaluate(() => window.closeThemeDetail?.());
  await page.evaluate(() => window.showTicker('AAPL'));
  await page.waitForFunction(() => document.getElementById('page-ticker')?.dataset.aioArchitectureRoute === 'ticker');
  await page.waitForFunction(() => document.getElementById('ticker-hero-name')?.textContent === 'AAPL', { timeout: 10000 });
  const tickerRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-ticker'),
    renderer: document.getElementById('page-ticker')?.dataset.aioArchitectureRenderer || null,
    rawPrimarySinkCount: document.querySelectorAll('#page-ticker #ticker-hero-name, #page-ticker #ticker-hero-fullname, #page-ticker #ticker-hero-price, #page-ticker #ticker-hero-chg').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-name, #page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-fullname, #page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-price, #page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-chg').length,
    primaryValues: ['ticker-hero-name', 'ticker-hero-fullname', 'ticker-hero-price', 'ticker-hero-chg'].map((id) => document.getElementById(id)?.textContent || null),
    pnlRenderer: document.getElementById('ticker-hero-value')?.dataset.aioTickerPnlRenderer || null,
    pnlText: document.getElementById('ticker-hero-value')?.textContent || '',
    pnlParentRenderer: document.getElementById('ticker-hero-pnl')?.dataset.aioTickerPnlRenderer || null,
    extensionRenderer: document.getElementById('ticker-hero-ext')?.dataset.aioTickerExtensionRenderer || null,
    extensionDisplay: document.getElementById('ticker-hero-ext')?.style.display || '',
    extensionText: document.getElementById('ticker-hero-ext')?.textContent || '',
    symbolRenderer: document.getElementById('ticker-candle-symbol')?.dataset.aioTickerSymbolRenderer || null,
    candleSymbol: document.getElementById('ticker-candle-symbol')?.textContent || '',
    entrySymbol: document.getElementById('ticker-entry-symbol')?.textContent || ''
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('options'));
  await page.waitForFunction(() => document.getElementById('page-options')?.dataset.aioArchitectureRoute === 'options');
  const optionsRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-options'),
    renderer: document.getElementById('page-options')?.dataset.aioArchitectureRenderer || null,
    rawPrimarySinkCount: document.querySelectorAll('#page-options #opt-vix-val-secondary, #page-options #opt-pcr-val-secondary, #page-options #opt-skew-val-secondary').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-options[data-aio-architecture-renderer="native"] #opt-vix-val-secondary, #page-options[data-aio-architecture-renderer="native"] #opt-pcr-val-secondary, #page-options[data-aio-architecture-renderer="native"] #opt-skew-val-secondary').length,
    primaryValues: ['opt-vix-val-secondary', 'opt-pcr-val-secondary', 'opt-skew-val-secondary'].map((id) => document.getElementById(id)?.textContent || null)
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('fundamental'));
  await page.waitForFunction(() => document.getElementById('page-fundamental')?.dataset.aioArchitectureRoute === 'fundamental');
  const fundamentalRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-fundamental'),
    renderer: document.getElementById('page-fundamental')?.dataset.aioArchitectureRenderer || null,
    rawPrimarySinkCount: document.querySelectorAll('#page-fundamental #fund-data-status').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-fundamental[data-aio-architecture-renderer="native"] #fund-data-status').length,
    statusValue: document.getElementById('fund-data-status')?.textContent || null,
    sourceKind: document.getElementById('fund-data-status')?.getAttribute('data-source-kind') || null,
    summaryRenderer: document.getElementById('fund-analysis-text')?.dataset.aioFundamentalSummaryRenderer || null,
    summaryText: document.getElementById('fund-analysis-text')?.textContent || null,
    summarySourceKind: document.getElementById('fund-analysis-text')?.getAttribute('data-source-kind') || null,
    reportRenderer: document.getElementById('page-fundamental')?.dataset.aioFundamentalReportRenderer || null,
    reportModel: document.getElementById('page-fundamental')?.dataset.aioSecReportModel || null,
    reportTitle: document.getElementById('fund-native-sec-title')?.textContent || '',
    reportMeta: document.getElementById('fund-native-sec-meta')?.textContent || '',
    reportCoverage: document.getElementById('fund-native-sec-coverage')?.textContent || '',
    reportGridRenderer: document.getElementById('fund-native-sec-grid')?.dataset.aioSecReportRenderer || null,
    reportMetricCount: document.querySelectorAll('#fund-native-sec-grid > div').length
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('portfolio'));
  await page.waitForFunction(() => document.getElementById('page-portfolio')?.dataset.aioArchitectureRoute === 'portfolio');
  const portfolioRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-portfolio'),
    renderer: document.getElementById('page-portfolio')?.dataset.aioArchitectureRenderer || null,
    heroRenderer: document.getElementById('pf-total-value')?.dataset.aioPortfolioHeroRenderer || null,
    heroValue: document.getElementById('pf-total-value')?.textContent || '',
    heroPnl: document.getElementById('pf-total-pnl')?.textContent || '',
    tableRenderer: document.getElementById('pf-positions-tbody')?.dataset.aioPortfolioTableRenderer || null,
    surfaceRenderer: document.getElementById('page-portfolio')?.dataset.aioPortfolioSurface || null,
    surfaceModel: document.getElementById('page-portfolio')?.dataset.aioPortfolioSurfaceModel || null,
    holdingCountRenderer: document.getElementById('pf-holding-count')?.dataset.aioPortfolioSurfaceRenderer || null,
    sectorRenderer: document.getElementById('pf-sector-breakdown')?.dataset.aioPortfolioSurfaceRenderer || null,
    exposureRenderer: document.getElementById('pf-exposure-current')?.dataset.aioPortfolioSurfaceRenderer || null,
    tableRowCount: document.querySelectorAll('#pf-positions-tbody tr').length,
    rawPrimarySinkCount: document.querySelectorAll('#page-portfolio #pf-analysis-status').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-portfolio[data-aio-architecture-renderer="native"] #pf-analysis-status').length,
    statusValue: document.getElementById('pf-analysis-status')?.textContent || null,
    sourceKind: document.getElementById('pf-analysis-status')?.getAttribute('data-source-kind') || null
  }));
  if (portfolioRoute.renderer !== 'native' || portfolioRoute.heroRenderer !== 'native' || !portfolioRoute.heroValue.trim() || !portfolioRoute.heroPnl.trim() || portfolioRoute.tableRenderer !== 'native' || portfolioRoute.surfaceRenderer !== 'native' || portfolioRoute.surfaceModel !== 'portfolio-surface.v1' || portfolioRoute.holdingCountRenderer !== 'native' || portfolioRoute.sectorRenderer !== 'native' || portfolioRoute.exposureRenderer !== 'native') throw new Error(`portfolio hero/table/summary native surface failed: ${JSON.stringify(portfolioRoute)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('technical'));
  await page.waitForFunction(() => document.getElementById('page-technical')?.dataset.aioArchitectureRoute === 'technical');
  const technicalRoute = await page.evaluate(() => {
    const primarySelectors = '#tech-health-pill, #health-score-display, #health-grade-display, #health-regime-display, #hc-spy-bar, #hc-qqq-bar, #hc-vix-bar, #ind-pressure-fill, #ind-buyrisk-fill, #ind-trend-fill, #health-interpretation';
    const score = document.getElementById('health-score-display');
    const before = score?.textContent || '';
    if (score) score.textContent = 'NATIVE-FENCE';
    window.computeMarketHealth?.();
    const fenceValue = score?.textContent || '';
    if (score) score.textContent = before;
    return {
      pageExists: !!document.getElementById('page-technical'),
      renderer: document.getElementById('page-technical')?.dataset.aioArchitectureRenderer || null,
      technicalRenderer: document.getElementById('page-technical')?.dataset.aioTechnicalRenderer || null,
      rawPrimarySinkCount: document.querySelectorAll(`#page-technical ${primarySelectors}`).length,
      nativePrimarySinkCount: document.querySelectorAll(`#page-technical[data-aio-architecture-renderer="native"] ${primarySelectors}`).length,
      score: before,
      grade: document.getElementById('health-grade-display')?.textContent || '',
      regime: document.getElementById('health-regime-display')?.textContent || '',
      candleMetaRenderer: document.getElementById('tech-candle-meta')?.dataset.aioTechnicalCandleMetaRenderer || null,
      candleTitle: document.getElementById('tech-candle-title')?.textContent || '',
      candleMeta: document.getElementById('tech-candle-meta')?.textContent || '',
      fenceValue
    };
  });
  if (technicalRoute.renderer !== 'native' || technicalRoute.technicalRenderer !== 'native' || technicalRoute.rawPrimarySinkCount !== 11 || technicalRoute.nativePrimarySinkCount !== 11 || !technicalRoute.score.trim() || !technicalRoute.grade.trim() || !technicalRoute.regime.trim() || technicalRoute.candleMetaRenderer !== 'native' || !technicalRoute.candleTitle.trim() || !technicalRoute.candleMeta.trim() || technicalRoute.fenceValue !== 'NATIVE-FENCE') throw new Error(`technical health/candle-meta native surface/fence failed: ${JSON.stringify(technicalRoute)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('signal'));
  await page.waitForFunction(() => document.getElementById('page-signal')?.dataset.aioArchitectureRoute === 'signal');
  const signalRoute = await page.evaluate(() => {
    const primarySelectors = '#score-gauge-val, #score-decision-badge, #score-decision-sub';
    const score = document.getElementById('score-gauge-val');
    const badge = document.getElementById('score-decision-badge');
    const sub = document.getElementById('score-decision-sub');
    const before = { score: score?.textContent || '', badge: badge?.textContent || '', sub: sub?.textContent || '' };
    if (score) score.textContent = 'NATIVE-FENCE';
    if (badge) badge.textContent = 'NATIVE-FENCE';
    if (sub) sub.textContent = 'NATIVE-FENCE';
    window.refreshSignalDashboard?.();
    const fenceValue = { score: score?.textContent || '', badge: badge?.textContent || '', sub: sub?.textContent || '' };
    if (score) score.textContent = before.score;
    if (badge) badge.textContent = before.badge;
    if (sub) sub.textContent = before.sub;
    return {
      pageExists: !!document.getElementById('page-signal'),
      renderer: document.getElementById('page-signal')?.dataset.aioArchitectureRenderer || null,
      signalRenderer: document.getElementById('page-signal')?.dataset.aioSignalRenderer || null,
      rawPrimarySinkCount: document.querySelectorAll(`#page-signal ${primarySelectors}`).length,
      nativePrimarySinkCount: document.querySelectorAll(`#page-signal[data-aio-architecture-renderer="native"] ${primarySelectors}`).length,
      score: before.score,
      badge: before.badge,
      fenceValue
    };
  });
  if (signalRoute.renderer !== 'native' || signalRoute.signalRenderer !== 'native' || signalRoute.rawPrimarySinkCount !== 3 || signalRoute.nativePrimarySinkCount !== 3 || Object.values(signalRoute.fenceValue).some((value) => value !== 'NATIVE-FENCE')) throw new Error(`signal native hero/fence failed: ${JSON.stringify(signalRoute)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('home'));
  await page.waitForFunction(() => document.getElementById('page-home')?.dataset.aioArchitectureRoute === 'home');
  const homeRoute = await page.evaluate(() => {
    const primarySelectors = '#home-hero-total, #home-hero-headline, #home-hero-desc, #home-trading-signal';
    const ids = ['home-hero-total', 'home-hero-headline', 'home-hero-desc', 'home-trading-signal'];
    const before = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)?.textContent || '']));
    ids.forEach((id) => { const element = document.getElementById(id); if (element) element.textContent = 'NATIVE-FENCE'; });
    window._aioRenderHomeHero?.();
    window.refreshHomeDashboard?.();
    const fenceValue = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)?.textContent || '']));
    ids.forEach((id) => { const element = document.getElementById(id); if (element) element.textContent = before[id]; });
    return {
      pageExists: !!document.getElementById('page-home'),
      renderer: document.getElementById('page-home')?.dataset.aioArchitectureRenderer || null,
      homeRenderer: document.getElementById('page-home')?.dataset.aioHomeRenderer || null,
      rawPrimarySinkCount: document.querySelectorAll(`#page-home ${primarySelectors}`).length,
      nativePrimarySinkCount: document.querySelectorAll(`#page-home[data-aio-architecture-renderer="native"] ${primarySelectors}`).length,
      fearGreedRenderer: document.getElementById('home-fg-score')?.dataset.aioHomeFearGreedRenderer || null,
      fearGreedScore: document.getElementById('home-fg-score')?.textContent || '',
      qualityRenderer: document.getElementById('home-quality-score')?.dataset.aioHomeQualityRenderer || null,
      qualityScore: document.getElementById('home-quality-score')?.textContent || '',
      qualityLabel: document.getElementById('home-quality-label')?.textContent || '',
      values: before,
      fenceValue
    };
  });
  if (homeRoute.renderer !== 'native' || homeRoute.homeRenderer !== 'native' || homeRoute.rawPrimarySinkCount !== 4 || homeRoute.nativePrimarySinkCount !== 4 || homeRoute.fearGreedRenderer !== 'native' || !homeRoute.fearGreedScore.trim() || homeRoute.qualityRenderer !== 'native' || !homeRoute.qualityScore.trim() || !homeRoute.qualityLabel.trim() || Object.values(homeRoute.fenceValue).some((value) => value !== 'NATIVE-FENCE')) throw new Error(`home native summary/Fear & Greed/quality/fence failed: ${JSON.stringify(homeRoute)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('briefing'));
  await page.waitForFunction(() => document.getElementById('page-briefing')?.dataset.aioArchitectureRoute === 'briefing');
  const contentRoutes = await page.evaluate(({ market, macro, fxbond, breadth, themes, themeDetail, ticker, options, fundamental, portfolio, technical, signal, home }) => ({
    active: window.AIO_ARCH.router.active(),
    // P770: market-news and briefing must expose native primary-feed markers; secondary AI digest
    // content remains a compatibility/narrative boundary.
    marketRenderer: market.renderer,
    marketFeedRenderer: market.feedRenderer,
    briefingRenderer: document.getElementById('page-briefing')?.dataset.aioArchitectureRenderer || null,
    briefingSlice: document.getElementById('page-briefing')?.dataset.aioArchitectureSlice || null,
    briefingFeedRenderer: document.getElementById('briefing-live-news-list')?.dataset.aioBriefingRenderer || null,
    macroRenderer: macro.renderer,
    macroPrimaryRenderer: macro.macroRenderer,
    fxbondRenderer: fxbond.renderer,
    fxbondPrimaryRenderer: fxbond.fxbondRenderer,
    breadthRenderer: breadth.renderer,
    breadthPrimaryRenderer: breadth.breadthRenderer,
    technicalRenderer: technical.renderer,
    technicalPrimaryRenderer: technical.technicalRenderer,
    themesRenderer: themes.renderer,
    themesPrimaryRenderer: themes.themesRenderer,
    themeDetailNativeSummary: themeDetail.nativeSummaryExists && !themeDetail.nativeSummaryHidden,
    tickerRenderer: ticker.renderer,
    optionsRenderer: options.renderer,
    fundamentalRenderer: fundamental.renderer,
    portfolioRenderer: portfolio.renderer
    ,signalRenderer: signal.renderer
    ,signalHeroRenderer: signal.signalRenderer
    ,homeRenderer: home.renderer
    ,homeSummaryRenderer: home.homeRenderer
  }), { market: marketRoute, macro: macroRoute, fxbond: fxbondRoute, breadth: breadthRoute, themes: themesRoute, themeDetail: themeDetailRoute, ticker: tickerRoute, options: optionsRoute, fundamental: fundamentalRoute, portfolio: portfolioRoute, technical: technicalRoute, signal: signalRoute, home: homeRoute });
  if (contentRoutes.active !== 'briefing' || contentRoutes.marketRenderer !== 'native' || contentRoutes.marketFeedRenderer !== 'native' || contentRoutes.briefingRenderer !== 'native' || contentRoutes.briefingSlice !== 'news' || contentRoutes.briefingFeedRenderer !== 'native' || contentRoutes.macroRenderer !== 'native' || contentRoutes.macroPrimaryRenderer !== 'native' || contentRoutes.fxbondRenderer !== 'native' || contentRoutes.fxbondPrimaryRenderer !== 'native' || contentRoutes.breadthRenderer !== 'native' || contentRoutes.breadthPrimaryRenderer !== 'native' || contentRoutes.technicalRenderer !== 'native' || contentRoutes.technicalPrimaryRenderer !== 'native' || contentRoutes.signalRenderer !== 'native' || contentRoutes.signalHeroRenderer !== 'native' || contentRoutes.homeRenderer !== 'native' || contentRoutes.homeSummaryRenderer !== 'native' || contentRoutes.themesRenderer !== 'native' || contentRoutes.themesPrimaryRenderer !== 'native' || !contentRoutes.themeDetailNativeSummary || contentRoutes.tickerRenderer !== 'native' || contentRoutes.optionsRenderer !== 'native' || contentRoutes.fundamentalRenderer !== 'native' || contentRoutes.portfolioRenderer !== 'native' || macroRoute.nativeLiveSinkCount < 1 || macroRoute.primarySnapSinkCount < 1 || macroRoute.fedMeaningRenderer !== 'native' || !macroRoute.fedMeaningText.trim() || fxbondRoute.nativeLiveSinkCount < 1 || fxbondRoute.nativeMoveSinkCount < 1 || fxbondRoute.riskRenderer !== 'native' || !fxbondRoute.riskText.trim() || breadthRoute.rawPrimarySinkCount < 1 || breadthRoute.nativePrimarySinkCount !== breadthRoute.rawPrimarySinkCount || breadthRoute.signalRenderer !== 'native' || !breadthRoute.signalText.trim() || breadthRoute.diagnosticRenderer !== 'native' || !breadthRoute.diagnosticSignal.trim() || !breadthRoute.diagnosticText.trim() || themesRoute.rawPrimarySinkCount !== 2 || themesRoute.nativePrimarySinkCount !== 2 || tickerRoute.rawPrimarySinkCount !== 4 || tickerRoute.nativePrimarySinkCount !== 4 || tickerRoute.symbolRenderer !== 'native' || !tickerRoute.candleSymbol.trim() || !tickerRoute.entrySymbol.trim() || tickerRoute.pnlRenderer !== 'native' || tickerRoute.pnlParentRenderer !== 'native' || tickerRoute.extensionRenderer !== 'native' || optionsRoute.rawPrimarySinkCount !== 3 || optionsRoute.nativePrimarySinkCount !== 3 || fundamentalRoute.rawPrimarySinkCount !== 1 || fundamentalRoute.nativePrimarySinkCount !== 1 || fundamentalRoute.summaryRenderer !== 'native' || !fundamentalRoute.summaryText.trim() || !fundamentalRoute.summarySourceKind || fundamentalRoute.reportRenderer !== 'native' || fundamentalRoute.reportModel !== 'sec-report.v1' || !fundamentalRoute.reportTitle.trim() || !fundamentalRoute.reportMeta.trim() || !fundamentalRoute.reportCoverage.trim() || fundamentalRoute.reportGridRenderer !== 'native' || portfolioRoute.rawPrimarySinkCount !== 1 || portfolioRoute.nativePrimarySinkCount !== 1 || portfolioRoute.tableRenderer !== 'native') throw new Error(`content route lifecycle failed: ${JSON.stringify({ contentRoutes, macroRoute, fxbondRoute, breadthRoute, technicalRoute, signalRoute, homeRoute, themesRoute, themeDetailRoute, tickerRoute, optionsRoute, fundamentalRoute, portfolioRoute })}`);

  if (fxbondRoute.curveRenderer !== 'native' || !fxbondRoute.curveText.trim() || fxbondRoute.carryRenderer !== 'native' || !fxbondRoute.carryText.trim() || fxbondRoute.carryScoreRenderer !== 'native' || !fxbondRoute.carryScoreText.trim() || !fxbondRoute.carryScoreBar.trim() || !fxbondRoute.carryVerdict.trim() || fxbondRoute.camRenderer !== 'native' || !fxbondRoute.camText.trim() || fxbondRoute.curveStatusRenderer !== 'native' || !fxbondRoute.curveStatusText.trim() || fxbondRoute.twoYearRenderer !== 'native' || !fxbondRoute.twoYearText.trim() || fxbondRoute.nativeChartMarkers.some((marker) => marker !== 'native') || fxbondRoute.chartKinds.some((kind) => !['unavailable', 'server-history', 'live', 'public-information-service'].includes(kind))) throw new Error(`fxbond secondary surface failed: ${JSON.stringify(fxbondRoute)}`);
  if (breadthRoute.stageRenderer !== 'native' || !breadthRoute.stageText.trim() || breadthRoute.mcclellanRenderer !== 'native' || !breadthRoute.mcclellanText.trim() || breadthRoute.nativeChartMarkers.some((marker) => marker !== 'native') || breadthRoute.chartKinds.some((kind) => !['unavailable', 'server-history', 'live', 'server-history', 'public-information-service', 'derived'].includes(kind))) throw new Error(`breadth secondary surface failed: ${JSON.stringify(breadthRoute)}`);

  // RM-05 item 2: two full 17-route A→B→...→A laps, asserting no resource accumulation between
  // lap 1 and lap 2. Two laps (not one before/after snapshot) because window._aioTimerRegistry
  // legitimately grows on first-ever visit to a route that registers a named recurring timer —
  // that is expected, not a leak. Only growth on the SECOND lap (every route already visited
  // once) is a genuine signal. Deliberately observable-proxy based (canvas count for the
  // chart-owning route, the legacy named-timer registry size, and browserErrors) rather than a
  // full listener census — Chromium has no production-safe "list all listeners" API; CDP's
  // getEventListeners would work but adds a real maintenance cost this gate does not yet justify.
  // 2026-07-21: root-caused an intermittent false positive here — js/aio-data.js:6630 calls
  // startDataScheduler() (which registers the 'dataStatus' timer) via a flat, non-jittered
  // setTimeout(fn, 15000) at boot, decoupled from route navigation entirely. If the two laps'
  // combined wall-clock time happens to straddle that 15s mark, 'dataStatus' appears "new" between
  // the lap1 and lap2 snapshots even though no route was involved — not a leak, a boot-timing race
  // in this gate's own measurement window. Waiting for that one boot-delayed timer to exist before
  // lap 1 starts makes both snapshots observe a stable post-boot state, which is what this
  // assertion was always supposed to compare.
  await page.waitForFunction(() => window._aioTimerRegistry && 'dataStatus' in window._aioTimerRegistry, { timeout: 20000 });
  const ROUTE_IDS_FOR_ROUNDTRIP = ['home', 'signal', 'breadth', 'sentiment', 'briefing', 'technical', 'macro', 'fxbond', 'themes', 'theme-detail', 'ticker', 'fundamental', 'options', 'portfolio', 'market-news', 'screener', 'guide'];
  async function traverseAllRoutes() {
    for (const route of ROUTE_IDS_FOR_ROUNDTRIP) {
      await page.evaluate((r) => window.AIO_ARCH.navigate(r), route);
      // P826: theme-detail is a derived inline surface whose canonical owner is
      // the themes page. The compatibility facade intentionally replays that
      // canonical route, so the round-trip wait must assert the owner mount and
      // the visible native detail panel rather than the retired standalone page.
      const canonicalRoute = route === 'theme-detail' ? 'themes' : route;
      await page.waitForFunction((r) => document.getElementById(`page-${r}`)?.dataset.aioArchitectureRoute === r, canonicalRoute);
      if (route === 'theme-detail') {
        await page.waitForFunction(() => {
          const panel = document.getElementById('theme-detail-panel');
          const summary = document.getElementById('theme-detail-native-summary');
          return !!panel && panel.style.display !== 'none' && !!panel.dataset.currentTheme
            && !!summary && !summary.hidden && (summary.textContent || '').trim().length > 40;
        });
      }
    }
  }
  const snapshot = () => page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    timers: window._aioTimerRegistry ? Object.keys(window._aioTimerRegistry).length : null
  }));
  await traverseAllRoutes();
  const afterLap1 = await snapshot();
  await traverseAllRoutes();
  const afterLap2 = await snapshot();
  if (errors.length) throw new Error(`browser errors during 17-route round trip: ${errors.join(' | ')}`);
  if (afterLap2.canvases !== afterLap1.canvases) throw new Error(`canvas count changed between lap 1 and lap 2 of the full route round trip: ${afterLap1.canvases} -> ${afterLap2.canvases}`);
  if (afterLap1.timers != null && afterLap2.timers != null && afterLap2.timers > afterLap1.timers) throw new Error(`legacy timer registry grew between lap 1 and lap 2 of the full route round trip: ${afterLap1.timers} -> ${afterLap2.timers}`);
  const roundTripEvidence = { routes: ROUTE_IDS_FOR_ROUNDTRIP.length, afterLap1, afterLap2 };

  // P787 browser evidence: the home summary remains native after a complete route round trip.
  await page.evaluate(() => window.AIO_ARCH.navigate('home'));
  await page.waitForFunction(() => document.getElementById('page-home')?.dataset.aioArchitectureRoute === 'home');
  const homeSurface = await page.evaluate(() => ({
    renderer: document.getElementById('page-home')?.dataset.aioArchitectureRenderer || null,
    homeRenderer: document.getElementById('page-home')?.dataset.aioHomeRenderer || null,
    heroTotal: document.getElementById('home-hero-total')?.textContent ?? null,
    headline: document.getElementById('home-hero-headline')?.textContent ?? null,
    tradingSignal: document.getElementById('home-trading-signal')?.textContent ?? null
  }));
  const placeholderPattern = /^(—|-|• • •|)$/;
  const koreanPattern = /[가-힣]/;
  if (homeSurface.renderer !== 'native' || homeSurface.homeRenderer !== 'native') throw new Error(`home renderer marker regressed after round trip: ${JSON.stringify(homeSurface)}`);
  if (!placeholderPattern.test(homeSurface.heroTotal || '') && !/^\d{1,3}\*?$/.test(homeSurface.heroTotal || '')) throw new Error(`home hero score is neither a placeholder nor an integer 0-100: ${JSON.stringify(homeSurface)}`);
  if (!placeholderPattern.test(homeSurface.tradingSignal || '') && !koreanPattern.test(homeSurface.tradingSignal || '')) throw new Error(`home-trading-signal is neither a placeholder nor a Korean label: ${JSON.stringify(homeSurface)}`);

  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, boot, quoteTopbar, sentimentRoute, guideRoute, contentRoutes, macroRoute, fxbondRoute, breadthRoute, technicalRoute, signalRoute, homeRoute, themesRoute, themeDetailRoute, tickerRoute, optionsRoute, fundamentalRoute, portfolioRoute, homeSurface, roundTripEvidence, routeRoundTrip: true, browserErrors: 0 }));
} finally {
  await browser.close();
  server.kill();
}
