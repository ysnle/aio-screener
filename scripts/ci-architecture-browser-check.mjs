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
    htmlHasLiveAttr: document.getElementById('page-macro')?.innerHTML.includes('data-live-price') || false
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('fxbond'));
  await page.waitForFunction(() => document.getElementById('page-fxbond')?.dataset.aioArchitectureRoute === 'fxbond');
  const fxbondRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-fxbond'),
    renderer: document.getElementById('page-fxbond')?.dataset.aioArchitectureRenderer || null,
    fxbondRenderer: document.getElementById('page-fxbond')?.dataset.aioFxbondRenderer || null,
    rawLiveSinkCount: document.querySelectorAll('#page-fxbond [data-live-price], #page-fxbond [data-live-chg]').length,
    nativeLiveSinkCount: document.querySelectorAll('#page-fxbond[data-aio-architecture-renderer="native"] [data-live-price], #page-fxbond[data-aio-architecture-renderer="native"] [data-live-chg]').length,
    rawMoveSinkCount: document.querySelectorAll('#page-fxbond [data-snap="move"]').length,
    nativeMoveSinkCount: document.querySelectorAll('#page-fxbond[data-aio-architecture-renderer="native"] [data-snap="move"]').length
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('breadth'));
  await page.waitForFunction(() => document.getElementById('page-breadth')?.dataset.aioArchitectureRoute === 'breadth');
  const breadthRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-breadth'),
    renderer: document.getElementById('page-breadth')?.dataset.aioArchitectureRenderer || null,
    breadthRenderer: document.getElementById('page-breadth')?.dataset.aioBreadthRenderer || null,
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
    rawPrimarySinkCount: document.querySelectorAll('#page-themes #rrg-quadrant-cards, #page-themes #rrg-rotation-read').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-themes[data-aio-architecture-renderer="native"] #rrg-quadrant-cards[data-aio-themes-renderer="native"], #page-themes[data-aio-architecture-renderer="native"] #rrg-rotation-read').length,
    quadrantCount: document.querySelectorAll('#page-themes #rrg-quadrant-cards [data-theme-quadrant]').length
  }));
  await page.evaluate(() => window.showTicker('AAPL'));
  await page.waitForFunction(() => document.getElementById('page-ticker')?.dataset.aioArchitectureRoute === 'ticker');
  await page.waitForFunction(() => document.getElementById('ticker-hero-name')?.textContent === 'AAPL', { timeout: 10000 });
  const tickerRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-ticker'),
    renderer: document.getElementById('page-ticker')?.dataset.aioArchitectureRenderer || null,
    rawPrimarySinkCount: document.querySelectorAll('#page-ticker #ticker-hero-name, #page-ticker #ticker-hero-fullname, #page-ticker #ticker-hero-price, #page-ticker #ticker-hero-chg').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-name, #page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-fullname, #page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-price, #page-ticker[data-aio-architecture-renderer="native"] #ticker-hero-chg').length,
    primaryValues: ['ticker-hero-name', 'ticker-hero-fullname', 'ticker-hero-price', 'ticker-hero-chg'].map((id) => document.getElementById(id)?.textContent || null)
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
    sourceKind: document.getElementById('fund-data-status')?.getAttribute('data-source-kind') || null
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('portfolio'));
  await page.waitForFunction(() => document.getElementById('page-portfolio')?.dataset.aioArchitectureRoute === 'portfolio');
  const portfolioRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-portfolio'),
    renderer: document.getElementById('page-portfolio')?.dataset.aioArchitectureRenderer || null,
    rawPrimarySinkCount: document.querySelectorAll('#page-portfolio #pf-analysis-status').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-portfolio[data-aio-architecture-renderer="native"] #pf-analysis-status').length,
    statusValue: document.getElementById('pf-analysis-status')?.textContent || null,
    sourceKind: document.getElementById('pf-analysis-status')?.getAttribute('data-source-kind') || null
  }));
  await page.evaluate(() => window.AIO_ARCH.navigate('briefing'));
  await page.waitForFunction(() => document.getElementById('page-briefing')?.dataset.aioArchitectureRoute === 'briefing');
  const contentRoutes = await page.evaluate(({ market, macro, fxbond, breadth, themes, ticker, options, fundamental, portfolio }) => ({
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
    themesRenderer: themes.renderer,
    themesPrimaryRenderer: themes.themesRenderer,
    tickerRenderer: ticker.renderer,
    optionsRenderer: options.renderer,
    fundamentalRenderer: fundamental.renderer,
    portfolioRenderer: portfolio.renderer
  }), { market: marketRoute, macro: macroRoute, fxbond: fxbondRoute, breadth: breadthRoute, themes: themesRoute, ticker: tickerRoute, options: optionsRoute, fundamental: fundamentalRoute, portfolio: portfolioRoute });
  if (contentRoutes.active !== 'briefing' || contentRoutes.marketRenderer !== 'native' || contentRoutes.marketFeedRenderer !== 'native' || contentRoutes.briefingRenderer !== 'native' || contentRoutes.briefingSlice !== 'news' || contentRoutes.briefingFeedRenderer !== 'native' || contentRoutes.macroRenderer !== 'native' || contentRoutes.macroPrimaryRenderer !== 'native' || contentRoutes.fxbondRenderer !== 'native' || contentRoutes.fxbondPrimaryRenderer !== 'native' || contentRoutes.breadthRenderer !== 'native' || contentRoutes.breadthPrimaryRenderer !== 'native' || contentRoutes.themesRenderer !== 'native' || contentRoutes.themesPrimaryRenderer !== 'native' || contentRoutes.tickerRenderer !== 'native' || contentRoutes.optionsRenderer !== 'native' || contentRoutes.fundamentalRenderer !== 'native' || contentRoutes.portfolioRenderer !== 'native' || macroRoute.nativeLiveSinkCount < 1 || macroRoute.primarySnapSinkCount < 1 || fxbondRoute.nativeLiveSinkCount < 1 || fxbondRoute.nativeMoveSinkCount < 1 || breadthRoute.rawPrimarySinkCount < 1 || breadthRoute.nativePrimarySinkCount !== breadthRoute.rawPrimarySinkCount || themesRoute.rawPrimarySinkCount !== 2 || themesRoute.nativePrimarySinkCount !== 2 || tickerRoute.rawPrimarySinkCount !== 4 || tickerRoute.nativePrimarySinkCount !== 4 || optionsRoute.rawPrimarySinkCount !== 3 || optionsRoute.nativePrimarySinkCount !== 3 || fundamentalRoute.rawPrimarySinkCount !== 1 || fundamentalRoute.nativePrimarySinkCount !== 1 || portfolioRoute.rawPrimarySinkCount !== 1 || portfolioRoute.nativePrimarySinkCount !== 1) throw new Error(`content route lifecycle failed: ${JSON.stringify({ contentRoutes, macroRoute, fxbondRoute, breadthRoute, themesRoute, tickerRoute, optionsRoute, fundamentalRoute, portfolioRoute })}`);

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
      await page.waitForFunction((r) => document.getElementById(`page-${r}`)?.dataset.aioArchitectureRoute === r, route);
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

  // RM-01 AG-DOM-WRITER browser evidence: home must show the legacy-rendered Korean 5-band label
  // and 0-100 integer score, never the retired native toy model's English action word or -1..1
  // decimal (analysis.js no longer writes either id, so this also proves legacy alone renders them
  // without a native competitor silently winning the last-writer-wins race).
  await page.evaluate(() => window.AIO_ARCH.navigate('home'));
  await page.waitForFunction(() => document.getElementById('page-home')?.dataset.aioArchitectureRoute === 'home');
  const homeSurface = await page.evaluate(() => ({
    scoreGaugeVal: document.getElementById('score-gauge-val')?.textContent ?? null,
    tradingSignal: document.getElementById('home-trading-signal')?.textContent ?? null
  }));
  const placeholderPattern = /^(—|-|• • •|)$/;
  const retiredDecimalPattern = /^-?\d*\.\d+$/;
  const retiredEnglishActionPattern = /^(WATCH|HOLD|REDUCE|BUY|SELL)$/i;
  const koreanPattern = /[가-힣]/;
  if (retiredDecimalPattern.test(homeSurface.scoreGaugeVal || '')) throw new Error(`score-gauge-val regressed to retired native decimal format: ${JSON.stringify(homeSurface)}`);
  if (!placeholderPattern.test(homeSurface.scoreGaugeVal || '') && !/^\d{1,3}\*?$/.test(homeSurface.scoreGaugeVal || '')) throw new Error(`score-gauge-val is neither a placeholder nor an integer 0-100 (legacy may append '*' for an estimated/stale annotation): ${JSON.stringify(homeSurface)}`);
  if (retiredEnglishActionPattern.test(homeSurface.tradingSignal || '')) throw new Error(`home-trading-signal regressed to retired native English action word: ${JSON.stringify(homeSurface)}`);
  if (!placeholderPattern.test(homeSurface.tradingSignal || '') && !koreanPattern.test(homeSurface.tradingSignal || '')) throw new Error(`home-trading-signal is neither a placeholder nor a Korean label: ${JSON.stringify(homeSurface)}`);

  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, boot, sentimentRoute, guideRoute, contentRoutes, macroRoute, fxbondRoute, breadthRoute, themesRoute, tickerRoute, optionsRoute, fundamentalRoute, portfolioRoute, homeSurface, roundTripEvidence, routeRoundTrip: true, browserErrors: 0 }));
} finally {
  await browser.close();
  server.kill();
}
