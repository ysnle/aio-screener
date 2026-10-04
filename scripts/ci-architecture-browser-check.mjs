import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ROUTE_IDS } from '../src/app/routes.js';
import { isRecognizedSourceKind } from '../src/data/contracts/source-kind.js';
import { PORTFOLIO_SURFACE_MODEL_VERSION } from '../src/domain/portfolio/surface.js';
import { DESKTOP_PRIMARY_VIEWPORT } from './desktop-qa-config.mjs';

// Chart provenance is asserted against the canonical source-kind contract rather
// than a hand-maintained list. A chart may declare an explicit non-tier sentinel
// or any recognized tier/alias, so a canonical tier like T3_PUBLIC_DELAYED can
// never fail this gate merely because the list was not extended in lockstep with
// src/data/contracts/source-kind.js (P1074).
const NON_TIER_CHART_KINDS = new Set(['unavailable', 'live', 'derived']);
const chartKindAllowed = (kind) => NON_TIER_CHART_KINDS.has(String(kind || '').trim().toLowerCase()) || isRecognizedSourceKind(kind);

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
  const page = await browser.newPage({ viewport: DESKTOP_PRIMARY_VIEWPORT });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // RM-05: the 17-route round trip visits routes (macro/fxbond/etc.) the original smaller test
    // sequence never reached, each with their own [AIO:api] health tracker that escalates
    // warn→error after enough blocked-network attempts — expected and harmless offline, matching
    // the existing proxy-primary allowance generalized to any tracked API name.
    if (message.type() === 'error' && !/net::ERR_FAILED/.test(message.text()) && !/^\[AIO:api\] [\w-]+: warn → error/.test(message.text())) errors.push(message.text());
  });
  const waitForTopbar = async (needle, label, timeout = 30000) => {
    try {
      await page.waitForFunction((expected) => document.getElementById('live-quote-ts')?.textContent?.includes(expected), needle, { timeout });
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const el = document.getElementById('live-quote-ts');
        return {
          text: el?.textContent || '',
          title: el?.getAttribute('title') || '',
          className: el?.dataset?.currentness || '',
          snapshotMeta: window._aioMarketSnapshotMeta || null,
          serverMeta: window._serverDataMeta || null,
          readyState: document.readyState
        };
      });
      throw new Error(`${label} topbar did not reach ${JSON.stringify(needle)}: ${JSON.stringify(diagnostic)}; cause=${error.message}`);
    }
  };
  const dispatchMarketSnapshot = async (detail) => page.evaluate((payload) => {
    // aio-data retains metadata on window while the core page bus renders the
    // document event; publish on both targets to mirror the production bridge.
    document.dispatchEvent(new CustomEvent('aio:marketSnapshot', { detail: payload }));
    window.dispatchEvent(new CustomEvent('aio:marketSnapshot', { detail: payload }));
  }, detail);
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
  await waitForTopbar('서버 ', 'initial snapshot', 15000);
  const quoteTopbar = await page.evaluate(() => {
    const el = document.getElementById('live-quote-ts');
    return {
      text: el?.textContent || '',
      duplicate: !!document.getElementById('live-quote-ts-topbar'),
      className: el?.dataset?.currentness || '',
      title: el?.getAttribute('title') || ''
    };
  });
  // P1326/R671 (QA-UX-07): one slot, one vocabulary — a server snapshot is 종가/지난 시세, never live.
  if (!/^서버 .+ · 16개$/.test(quoteTopbar.text) || !/^(close|stale)$/.test(quoteTopbar.className) || !/실시간 시세가 아닌/.test(quoteTopbar.title) || quoteTopbar.duplicate) {
    throw new Error(`snapshot quote topbar must stay reference-only while external providers are blocked: ${JSON.stringify(quoteTopbar)}`);
  }

  // A snapshot identity/count alone must never make an unpublished or degraded
  // payload look decision-ready. Exercise the fail-closed boundary in-browser,
  // then restore the published fixture so the remaining route checks observe
  // the normal reference snapshot state.
  await dispatchMarketSnapshot({
    revision: 'browser-fixture-unpublished',
    count: 16,
    generatedAt: '2026-09-05T00:00:00.000Z',
    marketSnapshotPublished: false,
    status: 'degraded'
  });
  await waitForTopbar('스냅샷 미게시', 'unpublished snapshot');
  const unpublishedQuoteTopbar = await page.evaluate(() => {
    const el = document.getElementById('live-quote-ts');
    return { text: el?.textContent || '', title: el?.getAttribute('title') || '' };
  });
  if (!/스냅샷 미게시/.test(unpublishedQuoteTopbar.text) || !/판단에 사용하지 않음/.test(unpublishedQuoteTopbar.title)) {
    throw new Error(`unpublished snapshot must fail closed in the visible topbar: ${JSON.stringify(unpublishedQuoteTopbar)}`);
  }
  await dispatchMarketSnapshot({
    revision: 'browser-fixture-published',
    count: 16,
    generatedAt: '2026-09-05T00:00:00.000Z',
    latestObservedAt: '2026-09-05T00:00:00.000Z',
    marketSnapshotPublished: true,
    status: 'published'
  });
  await waitForTopbar('서버 ', 'published snapshot restore');

  await page.evaluate(() => {
    const observedAt = '2026-09-24T12:00:00Z';
    const treasury = {
      observedAt,
      source: 'U.S. Treasury Daily Par Yield Curve Rates XML Feed',
      sourceKind: 'T1_OFFICIAL',
      cutId: 'us-treasury-daily:2026-09-24',
      values: { dgs2: 4.85, dgs5: 4.99, dgs10: 5.11, dgs20: 5.45, dgs30: 5.4, t10y2y: 0.26 }
    };
    window._serverDataMeta = window._serverDataMeta || {};
    window._serverDataMeta.treasury = treasury;
    window.DATA_SNAPSHOT = window.DATA_SNAPSHOT || {};
    window.DATA_SNAPSHOT.tnx2y = 4.85;
    window.DATA_SNAPSHOT.tnx = 5.11;
    window.DATA_SNAPSHOT.t10y2y = 0.26;
    window.DATA_SNAPSHOT._fieldTs = window.DATA_SNAPSHOT._fieldTs || {};
    window.DATA_SNAPSHOT._fieldTs.macro_dgs2 = observedAt;
    window._live2Y = 4.85;
    window._live10Y = 5.11;
    window._fredData = { DGS2: { value: 4.85, observedAt }, DGS10: { value: 5.11, observedAt }, T10Y2Y: { value: 0.26, observedAt, unit: 'percentage-point', source: treasury.source } };
    // P1425: the 거시 boards read the published data.json macro block (official cut + monthly releases).
    window._aioServerMacro = { dgs2: 4.85, dgs5: 4.99, dgs10: 5.11, dgs20: 5.45, dgs30: 5.4, t10y2y: 0.26, _asOf_dgs2: '2026-09-24', _asOf_dgs5: '2026-09-24', _asOf_dgs10: '2026-09-24', _asOf_dgs20: '2026-09-24', _asOf_dgs30: '2026-09-24',
      cpi: 3.1, _asOf_cpi: '2026-08-01', _source_cpi: 'bls-official-primary', pce: 2.9, _asOf_pce: '2026-08-01', corePce: 2.8, _asOf_corePce: '2026-08-01', unemployment: 4.2, unemploymentDelta: 0.1, _asOf_unemployment: '2026-09-01',
      fedTargetLower: 3.75, fedTargetUpper: 4, _asOf_fedTargetLower: '2026-09-24', realYield10: 2.1, _asOf_realYield10: '2026-09-24', hyOAS: 3.1, _asOf_hyOAS: '2026-09-24' };
  });

  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  const sentimentRoute = await page.evaluate(() => ({
    active: window.AIO_ARCH.router.active(),
    storeRoute: window.AIO_ARCH.getState().route,
    // P1396: the five-card board replaced the overall badge; the page publishes its own state.
    state: document.getElementById('page-sentiment')?.dataset.aioArchitectureState,
    renderer: document.getElementById('page-sentiment')?.dataset.aioArchitectureRenderer,
    boardRenderer: document.getElementById('page-sentiment')?.dataset.aioSentimentBoardRenderer || null,
    cards: document.querySelectorAll('#page-sentiment .trend-card').length,
    badge: !!document.getElementById('sent-overall-badge')
  }));
  if (sentimentRoute.active !== 'sentiment' || sentimentRoute.storeRoute !== 'sentiment' || !['blocked', 'observed'].includes(sentimentRoute.state) || sentimentRoute.renderer !== 'native' || sentimentRoute.boardRenderer !== 'native' || sentimentRoute.cards !== 5 || sentimentRoute.badge) throw new Error(`sentiment lifecycle failed: ${JSON.stringify(sentimentRoute)}`);

  // P1425: the shell no longer prints snapshot-date rows (the fxbond 기준일 row left with the rebuild);
  // the binding is exercised on its own fixture sinks.
  const staleDateRoute = await page.evaluate(() => {
    const fixture = document.createElement('div');
    fixture.innerHTML = '<span data-snap-date="tnx-2y"></span><span id="tnx-2y-stale-days"></span>';
    document.body.appendChild(fixture);
    try {
      window._aioRenderSnapshotDates();
      const briefingStale = document.getElementById('briefing-stale-days')?.textContent || '';
      const tnxStale = document.getElementById('tnx-2y-stale-days')?.textContent || '';
      return { briefingStale, tnxStale, tnxDate: document.querySelector('[data-snap-date="tnx-2y"]')?.textContent || '' };
    } finally { fixture.remove(); }
  });
  if (staleDateRoute.tnxDate !== '2026-09-24' || staleDateRoute.tnxStale === staleDateRoute.briefingStale || !staleDateRoute.tnxStale.includes('일 경과')) throw new Error(`snapshot date item binding failed: ${JSON.stringify(staleDateRoute)}`);

  // P1396: the SKEW card had no current producer and was retired with the sentiment rebuild;
  // the page must not re-introduce an empty SKEW sink.
  if (await page.evaluate(() => !!document.getElementById('sent-skew-value'))) throw new Error('retired SKEW sink reappeared');

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
      capabilityManifest: document.getElementById('page-guide')?.dataset.aioCapabilityManifest,
      capabilityAudit: document.getElementById('page-guide')?.dataset.aioCapabilityAudit,
      capabilityStatus: document.getElementById('guide-capability-status')?.dataset.aioCapabilityStatus,
      visible: result?.style.display === 'block',
      resultButtons: result?.querySelectorAll('button[data-guide-target]').length || 0
    };
  });
  if (guideRoute.active !== 'guide' || guideRoute.renderer !== 'native' || guideRoute.capabilityManifest !== 'wave4.capability.v1' || guideRoute.capabilityAudit !== 'pass' || guideRoute.capabilityStatus !== 'pass' || !guideRoute.visible || guideRoute.resultButtons < 1) throw new Error(`guide lifecycle/search/capability failed: ${JSON.stringify(guideRoute)}`);

  await page.evaluate(() => window.AIO_ARCH.navigate('market-news'));
  await page.waitForFunction(() => document.getElementById('page-market-news')?.dataset.aioArchitectureRoute === 'market-news');
  const marketRoute = await page.evaluate(() => ({
    renderer: document.getElementById('page-market-news')?.dataset.aioArchitectureRenderer || null,
    feedRenderer: document.getElementById('live-news-feed')?.dataset.aioNewsRenderer || null
  }));
  await page.evaluate(() => {
    window.__aioNewsXssExecuted = false;
    const windowInfo = window._getBriefingWindowKST?.();
    const windowMidpoint = windowInfo
      ? (new Date(windowInfo.start).getTime() + new Date(windowInfo.end).getTime()) / 2
      : Date.now();
    const now = new Date(windowMidpoint).toISOString();
    window._allNewsItems = [{
      newsId: 'browser-news-entity-p1205',
      title: '네비우스 &#036;NBIS 한글 안전 뉴스의 &#60;img src=x onerror="window.__aioNewsXssExecuted=true"&#62; &amp;#036;DOUBLE',
      summary: ' &#036;NBIS 한글 &#60;script>window.__aioNewsXssExecuted=true<&#47;script>',
      source: 'Browser Fixture',
      link: 'https://example.test/nebius?x=1&amp;y=2',
      pubDate: now,
      fetchedAt: now,
      score: 100,
      topic: 'equity',
      country: 'us',
      contentDepth: 'summary',
      sourceTier: 1
    }];
    window._serverDataMeta = window._serverDataMeta || {};
    window._serverDataMeta.generatedAt = now;
    window._serverDataMeta.newsCycleEnd = new Date(Date.now() + 3600000).toISOString();
    document.dispatchEvent(new CustomEvent('aio:newsUpdated', { detail: { fixture: 'news-entity-p1205' } }));
  });
  // P1391: a top-scored item renders in the important list (and is excluded from the full feed).
  await page.waitForFunction(() => document.getElementById('page-market-news')?.textContent?.includes('네비우스 $NBIS'));
  const newsEntityRoute = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#page-market-news .news-item-card')].find((node) => node.textContent.includes('네비우스'));
    return {
      text: card?.textContent || '',
      imgCount: card?.querySelectorAll('img').length || 0,
      scriptCount: card?.querySelectorAll('script').length || 0,
      onerrorCount: card?.querySelectorAll('[onerror]').length || 0,
      doubleDecoded: (card?.textContent || '').includes('$DOUBLE'),
      xssExecuted: window.__aioNewsXssExecuted === true
    };
  });
  if (!newsEntityRoute.text.includes('네비우스 $NBIS 한글 안전') || newsEntityRoute.imgCount || newsEntityRoute.scriptCount || newsEntityRoute.onerrorCount || newsEntityRoute.doubleDecoded || newsEntityRoute.xssExecuted) throw new Error(`news text entity/XSS contract failed: ${JSON.stringify(newsEntityRoute)}`);
  // P1403: a server backstop item from an older cycle stays stale; only the latest cycle is trusted.
  const backstopCycle = await page.evaluate(() => {
    const contract = { newsCyclePolicy: 'kst-0800-completed-24h', windowHours: 24 };
    const nowMs = Date.now();
    const item = (cycleEndAgoH, pubAgoH) => ({ title: 'backstop fixture', source: 'Reuters', link: 'https://example.test/b', score: 80, topic: 'equity', contentDepth: 'summary', summary: 'x'.repeat(60),
      pubDate: new Date(nowMs - pubAgoH * 3600000).toISOString(), _serverBackstop: true, newsCyclePolicy: contract.newsCyclePolicy,
      newsCycleStart: new Date(nowMs - (cycleEndAgoH + 24) * 3600000).toISOString(), newsCycleEnd: new Date(nowMs - cycleEndAgoH * 3600000).toISOString() });
    const old = window._aioNormalizeNewsItem('market-news', item(30, 43.2), contract, nowMs, null);
    const latest = window._aioNormalizeNewsItem('market-news', item(2, 10), contract, nowMs, null);
    return { oldTrusted: old.serverCycleTrusted, oldStatus: old.verificationStatus, latestTrusted: latest.serverCycleTrusted };
  });
  if (backstopCycle.oldTrusted || backstopCycle.oldStatus !== 'stale' || !backstopCycle.latestTrusted) throw new Error(`P1403 server backstop cycle trust wrong: ${JSON.stringify(backstopCycle)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('macro'));
  await page.waitForFunction(() => document.getElementById('page-macro')?.dataset.aioArchitectureRoute === 'macro');
  // P1425: 거시 경제 is one native indicator board; the storyline, regime pill, curve canvas and 2Y/2s10s sinks are retired.
  const macroRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-macro'),
    renderer: document.getElementById('page-macro')?.dataset.aioArchitectureRenderer || null,
    macroRenderer: document.getElementById('page-macro')?.dataset.aioMacroRenderer || null,
    boardRenderer: document.getElementById('macro-board')?.dataset.aioMacroBoardRenderer || null,
    groups: [...document.querySelectorAll('#macro-board .macro-group')].map((node) => node.dataset.group),
    cpiCard: [...document.querySelectorAll('#macro-board .macro-stat')].find((node) => /^CPI/.test(node.querySelector('.macro-stat-label')?.textContent || ''))?.textContent || '',
    inflationFact: document.querySelector('#macro-board [data-group="inflation"] .macro-group-fact')?.textContent || '',
    impactAxes: [...document.querySelectorAll('#macro-axes .macro-axis')].map((node) => node.dataset.axis),
    chainNodes: document.querySelectorAll('#macro-chain .macro-chain-row .macro-chain-node').length,
    regimeLabel: document.querySelector('#macro-regime .macro-regime-label')?.textContent || '',
    gauges: document.querySelectorAll('#macro-axes .macro-gauge').length,
    tiles: document.querySelectorAll('#macro-regime .macro-tile').length,
    quadrant: !!document.querySelector('#macro-regime svg.macro-quadrant'),
    rawLiveSinkCount: document.querySelectorAll('#page-macro [data-live-price], #page-macro [data-live-chg]').length,
    nativeLiveSinkCount: document.querySelectorAll('#page-macro[data-aio-architecture-renderer="native"] [data-live-price], #page-macro[data-aio-architecture-renderer="native"] [data-live-chg]').length,
    retired: ['macro-storyline', 'macro-regime-pill', 'yieldCurveChart', 'macro-2y-value', 'macro-spread-value', 'thermometer-fill', 'macro-scenario-sum'].filter((id) => document.getElementById(id))
  }));
  if (macroRoute.boardRenderer !== 'native' || macroRoute.groups.join(',') !== 'policy,inflation,labor,activity' || !/3\.1%/.test(macroRoute.cpiCard) || !/8월분/.test(macroRoute.cpiCard) || !/연준 목표 2% 대비 \+0\.9%p, \+0\.8%p/.test(macroRoute.inflationFact) || macroRoute.impactAxes.join(',') !== 'growth,inflation,policy,rates,commodities,credit' || macroRoute.chainNodes !== 5 || !macroRoute.regimeLabel.trim() || macroRoute.gauges < 5 || macroRoute.tiles !== 6 || !macroRoute.quadrant || macroRoute.retired.length || macroRoute.rawLiveSinkCount !== macroRoute.nativeLiveSinkCount) throw new Error(`P1425/P1426 거시 경제 board failed: ${JSON.stringify(macroRoute)}`);

  // QA-CRED-05/P1264: 공유 Worker만 있는 환경에서 (a) 매크로의 FRED 계열 값은 출처 라벨과 함께
  // 표시되고, (b) 개인 키를 실은 URL은 공유 Worker로 중계되지 않으며 PRIVATE_ROUTE_REQUIRED
  // 사유 힌트로 거부된다 — 릴레이 2순위 배선이 개인 키를 공유 Worker에 넘기지 않는다는 것을
  // 브라우저에서 확인한다.
  const cred05 = await page.evaluate(async () => {
    const sourceLabel = document.getElementById('macro-2y-source')?.textContent || '';
    const twoYearValue = document.getElementById('macro-2y-value')?.textContent || '';
    let failure = null;
    try {
      await window.fetchViaProxy('https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=PERSONAL_KEY', { timeout: 1500, parseJson: true });
    } catch (err) {
      failure = { code: (err && err.code) || null, hint: (err && err.hint) || '' };
    }
    return { sourceLabel, twoYearValue, failure };
  });
  if (cred05.twoYearValue.trim() && !/FRED|DGS2/.test(cred05.sourceLabel)) throw new Error(`QA-CRED-05 FRED source label missing on the macro route: ${JSON.stringify(cred05)}`);
  if (!cred05.failure || cred05.failure.code !== 'PRIVATE_ROUTE_REQUIRED' || !/개인 키/.test(cred05.failure.hint) || !/공유 Worker/.test(cred05.failure.hint)) {
    throw new Error(`QA-CRED-05 a credential-bearing URL must be rejected with PRIVATE_ROUTE_REQUIRED and a reason hint under shared-worker-only routing: ${JSON.stringify(cred05)}`);
  }

  await page.evaluate(() => window.AIO_ARCH.navigate('fxbond'));
  await page.waitForFunction(() => document.getElementById('page-fxbond')?.dataset.aioArchitectureRoute === 'fxbond');
  // P1425: 금리 · 환율 = official curve, real yield/breakeven/credit, dollar/won/yen/10Y close-basis cards.
  const fxbondRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-fxbond'),
    renderer: document.getElementById('page-fxbond')?.dataset.aioArchitectureRenderer || null,
    fxbondRenderer: document.getElementById('page-fxbond')?.dataset.aioFxbondRenderer || null,
    boardRenderer: document.getElementById('page-fxbond')?.dataset.aioRatesBoardRenderer || null,
    yields: [...document.querySelectorAll('#rates-yields .rates-yield-value')].map((node) => node.textContent),
    spreads: document.getElementById('rates-spreads')?.textContent || '',
    curveFact: document.getElementById('rates-curve-fact')?.textContent || '',
    curveDots: document.querySelectorAll('#rates-curve .rates-curve-dot').length,
    levels: document.querySelectorAll('#rates-levels .macro-stat').length,
    impactAxes: [...document.querySelectorAll('#rates-axes .macro-axis')].map((node) => node.dataset.axis),
    fxCards: [...document.querySelectorAll('#rates-fx-grid .trend-card')].map((node) => node.dataset.metric),
    rawLiveSinkCount: document.querySelectorAll('#page-fxbond [data-live-price], #page-fxbond [data-live-chg]').length,
    nativeLiveSinkCount: document.querySelectorAll('#page-fxbond[data-aio-architecture-renderer="native"] [data-live-price], #page-fxbond[data-aio-architecture-renderer="native"] [data-live-chg]').length,
    retired: ['fxbond-risk-pill', 'yc-inversion-badge', 'carry-score-bar', 'cam-verdict-text', 'sc-2s10s', 'fxbond-tnx-trend', 'koreaCurveChart'].filter((id) => document.getElementById(id))
  }));
  // P1428 (Codex review): the same measure must read the same on every screen. F&G's day change came from
  // CNN's previous_close on home and from the completed-close history on 투자 심리 (+3 vs +2), and the
  // sentiment summary used 350bp/+15bp beside cards using 450bp/+25bp.
  await page.evaluate(() => window.AIO_ARCH.navigate('home'));
  await page.waitForFunction(() => document.getElementById('page-home')?.classList.contains('active'));
  const homeFg = await page.evaluate(() => document.getElementById('home-fg-delta')?.textContent || '');
  await page.evaluate(() => window.AIO_ARCH.navigate('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioSentimentBoardRenderer === 'native');
  const sentimentFg = await page.evaluate(() => document.querySelector('#page-sentiment [data-metric="fg"] .trend-card-change')?.textContent || '');
  const fgNumber = (text, label) => { const m = new RegExp(`${label}\\s*([+−-]?\\d+)`).exec(text); return m ? Number(m[1].replace('−', '-')) : null; };
  const homeFgDelta = fgNumber(homeFg, '전일 대비');
  const sentimentFgDelta = fgNumber(sentimentFg, '전일');
  if (homeFgDelta != null && sentimentFgDelta != null && homeFgDelta !== sentimentFgDelta) throw new Error(`P1428 F&G day change differs across screens: home=${homeFg} sentiment=${sentimentFg}`);
  const rulesShared = await page.evaluate(async () => {
    const { RULES } = await import(new URL('src/domain/rules/thresholds.js', document.baseURI).href);
    return RULES.credit.stressAtBp === 450 && RULES.credit.widen5dBp === 25;
  });
  if (!rulesShared) throw new Error('P1428 shared rule table missing or changed without updating the guide');
  if (fxbondRoute.boardRenderer !== 'native' || fxbondRoute.yields.join(',') !== '4.85%,4.99%,5.11%,5.45%,5.40%' || !/\+0\.26%p/.test(fxbondRoute.spreads) || !/\+0\.41%p/.test(fxbondRoute.spreads) || !/0\.26%p 높습니다/.test(fxbondRoute.curveFact) || fxbondRoute.curveDots !== 5 || fxbondRoute.levels !== 3 || fxbondRoute.impactAxes.join(',') !== 'policy,rates,commodities,credit,korea' || fxbondRoute.fxCards.join(',') !== 'dxy,usdkrw,usdjpy,tnx' || fxbondRoute.retired.length || fxbondRoute.rawLiveSinkCount !== fxbondRoute.nativeLiveSinkCount) throw new Error(`P1425 금리 · 환율 board failed: ${JSON.stringify(fxbondRoute)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('breadth'));
  await page.waitForFunction(() => document.getElementById('page-breadth')?.dataset.aioArchitectureRoute === 'breadth');
  // P1395: the breadth page is the native trend-card board (P1416: ten dated series in three groups + one judgement).
  const breadthRoute = await page.evaluate(() => ({
    pageExists: !!document.getElementById('page-breadth'),
    renderer: document.getElementById('page-breadth')?.dataset.aioArchitectureRenderer || null,
    breadthRenderer: document.getElementById('page-breadth')?.dataset.aioBreadthRenderer || null,
    boardRenderer: document.getElementById('page-breadth')?.dataset.aioBreadthBoardRenderer || null,
    state: document.getElementById('breadth-state')?.textContent || '',
    cards: document.querySelectorAll('#breadth-chart-grid .trend-card').length,
    charts: document.querySelectorAll('#breadth-chart-grid svg.trend-chart').length,
    retired: ['breadth-signal-val', 'breadth-diag-text', 'breadth-mcclellan-summary', 'bp-50ma-chart'].filter((id) => document.getElementById(id))
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
    performanceBarsRenderer: document.getElementById('sector-perf-bars')?.dataset.aioThemePerformanceBarsRenderer || null,
    performanceBarsRowCount: document.querySelectorAll('#sector-perf-bars [data-theme-performance-row]').length,
    performanceBarsText: document.getElementById('sector-perf-bars')?.textContent || '',
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
  if (themesRoute.renderer !== 'native' || themesRoute.themesRenderer !== 'native' || themesRoute.rrgStatusRenderer !== 'native' || !themesRoute.rrgStatusText.trim() || themesRoute.rrgChartRenderer !== 'native' || themesRoute.rrgCanvasSize[0] < 300 || themesRoute.rrgCanvasSize[1] < 180 || themesRoute.cycleRenderer !== 'native' || !themesRoute.cycleText.trim() || themesRoute.performanceNarrativeRenderer !== 'native' || !themesRoute.performanceNarrativeText.trim() || themesRoute.performanceBarsRenderer !== 'native' || !themesRoute.performanceBarsText.trim() || themesRoute.nativePrimarySinkCount !== themesRoute.rawPrimarySinkCount) throw new Error(`themes native primary/chart/status/cycle/narrative/bars boundary failed: ${JSON.stringify(themesRoute)}`);
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
  await page.evaluate(() => window.showTicker('NVDA'));
  await page.waitForFunction(() => document.getElementById('page-ticker')?.dataset.aioArchitectureRoute === 'ticker');
  await page.waitForFunction(() => document.getElementById('ticker-hero-name')?.textContent === 'NVDA', { timeout: 10000 });
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
    chartRenderer: document.getElementById('ticker-price-chart')?.dataset.aioTickerChartRenderer || null,
    chartSourceKind: document.getElementById('ticker-price-chart')?.dataset.sourceKind || null,
    symbolRenderer: document.getElementById('ticker-candle-symbol')?.dataset.aioTickerSymbolRenderer || null,
    candleSymbol: document.getElementById('ticker-candle-symbol')?.textContent || '',
    entrySymbol: null // P1430: the manual 가격·추세 위치 점검 calculator (ticker-entry-symbol) was retired
  }));
  if (tickerRoute.chartRenderer !== 'native' || !['unavailable', 'native-runtime'].includes(tickerRoute.chartSourceKind)) throw new Error(`ticker native chart surface failed: ${JSON.stringify(tickerRoute)}`);
  // P1430: the ticker page's inner tabs (재무 공시 · 가격 이력) were retired — the 종목 hub tabs own that
  // split, and the price chart is part of 요약 next to the price/theme/factor rail.
  const tickerLayout = await page.evaluate(() => ({
    innerTabs: document.querySelectorAll('#page-ticker [data-ticker-tab]').length,
    chartVisible: !!document.getElementById('ticker-price-chart')?.getClientRects().length,
    externalChart: !!document.getElementById('tv-widget-ticker'),
    hubTabs: [...document.querySelectorAll('#aio-hub-tabs .aio-hub-tab')].map((tab) => tab.dataset.arg)
  }));
  if (tickerLayout.innerTabs !== 0 || !tickerLayout.chartVisible || tickerLayout.externalChart || tickerLayout.hubTabs.join(',') !== 'ticker,technical,fundamental') throw new Error(`P1430 ticker summary layout failed: ${JSON.stringify(tickerLayout)}`);
  const tickerRangeEvidence = [];
  for (const [range, expectedRows] of [['1m', 31], ['3m', 91], ['6m', 181], ['1y', 366]]) {
    await page.evaluate(() => {
      const end = Date.parse('2026-09-24T00:00:00Z');
      const history = Array.from({ length: 400 }, (_, index) => {
        const daysAgo = 399 - index;
        return { time: new Date(end - daysAgo * 86400000).toISOString(), close: 100 + index, epochMs: end - daysAgo * 86400000, open: 100 + index, high: 101 + index, low: 99 + index, volume: 1 };
      });
      window._technicalOHLCV = { ...(window._technicalOHLCV || {}), NVDA: history };
      window._tickerHistory = { ...(window._tickerHistory || {}), NVDA: history };
      document.dispatchEvent(new CustomEvent('aio:entityChanged', { detail: { id: 'NVDA', source: 'ticker-browser-fixture' } }));
    });
    await page.locator(`#page-ticker [data-ticker-range="${range}"]`).click();
    await page.waitForFunction((expected) => {
      const canvas = document.getElementById('ticker-price-chart');
      return canvas?.dataset.tickerChartRange === expected.range
        && Number(canvas?.dataset.tickerChartRowCount || 0) === expected.rows
        && document.querySelector(`#page-ticker [data-ticker-range="${expected.range}"]`)?.getAttribute('aria-pressed') === 'true';
    }, { range, rows: expectedRows });
    await page.waitForFunction(() => {
      const canvas = document.getElementById('ticker-price-chart');
      const realChart = !!window.Chart?.getChart?.(canvas);
      const fallbackChart = window.Chart?.__aioFallback === true
        && canvas?.dataset.aioChartRegistry === 'ticker-price-chart'
        && document.getElementById('ticker-chart-loading')?.style.display === 'none';
      return realChart || fallbackChart;
    });
    tickerRangeEvidence.push(await page.evaluate(() => {
      const canvas = document.getElementById('ticker-price-chart');
      return {
        range: canvas?.dataset.tickerChartRange,
        rows: Number(canvas?.dataset.tickerChartRowCount || 0),
        start: canvas?.dataset.tickerChartStart,
        end: canvas?.dataset.tickerChartEnd,
        sourceKind: canvas?.dataset.sourceKind || null,
        rendered: !!window.Chart?.getChart?.(canvas) || window.Chart?.__aioFallback === true && canvas?.dataset.aioChartRegistry === 'ticker-price-chart',
        meta: document.getElementById('ticker-chart-meta')?.textContent || ''
      };
    }));
  }
  if (tickerRangeEvidence.map((item) => item.rows).join(',') !== '31,91,181,366'
    || new Set(tickerRangeEvidence.map((item) => item.range)).size !== 4
    || tickerRangeEvidence.some((item) => item.sourceKind !== 'native-runtime' || !item.rendered)) throw new Error(`ticker native range windows failed: ${JSON.stringify(tickerRangeEvidence)}`);
  tickerRoute.tabRangeEvidence = tickerRangeEvidence;
  const relatedTheme = page.locator('#page-ticker [data-action="showThemeDetail"][data-arg]').first();
  if (await relatedTheme.count() < 1) throw new Error('ticker related-theme action is unavailable for NVDA');
  const relatedThemeId = await relatedTheme.getAttribute('data-arg');
  await relatedTheme.click();
  await page.waitForFunction((themeId) => {
    const pageNode = document.getElementById('page-themes');
    const panel = document.getElementById('theme-detail-panel');
    const summary = document.getElementById('theme-detail-native-summary');
    return pageNode?.classList.contains('active')
      && panel?.style.display === 'block'
      && panel?.dataset.currentTheme === themeId
      && summary?.hidden === false
      && summary.textContent.includes('구성 기준일 미검증');
  }, relatedThemeId, { timeout: 10000 });
  const tickerThemeBridge = await page.evaluate((themeId) => ({
    requestedThemeId: themeId,
    activePage: document.querySelector('.page.active')?.id || null,
    panelThemeId: document.getElementById('theme-detail-panel')?.dataset.currentTheme || null,
    summaryText: document.getElementById('theme-detail-native-summary')?.textContent || '',
    pendingThemeId: window._aioOpenThemeDetailOnThemes || null
  }), relatedThemeId);
  if (tickerThemeBridge.activePage !== 'page-themes' || tickerThemeBridge.panelThemeId !== relatedThemeId || tickerThemeBridge.pendingThemeId !== null || !tickerThemeBridge.summaryText.includes('AIO 참고 테마 분류')) throw new Error(`ticker-to-theme lazy route handoff failed: ${JSON.stringify(tickerThemeBridge)}`);
  // P1321: the options route is retired; its old hash must alias to sentiment instead of a stub page.
  // QA-ROUTE-19 / R666
  const optionsRetired = await page.evaluate(() => ({ pageGone: !document.getElementById('page-options'), routeGone: !(window.AIO_ALL_ROUTE_PAGE_IDS || []).includes('options'), alias: window.AIO_ROUTE_REGISTRY?.canonical?.options || null }));
  if (!optionsRetired.pageGone || !optionsRetired.routeGone || optionsRetired.alias !== 'sentiment') throw new Error(`options retirement failed: ${JSON.stringify(optionsRetired)}`);
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
    chartRenderer: document.getElementById('pf-position-donut')?.dataset.aioPortfolioChartRenderer || null,
    chartSourceKind: document.getElementById('pf-position-donut')?.dataset.sourceKind || null,
    tableRowCount: document.querySelectorAll('#pf-positions-tbody tr').length,
    rawPrimarySinkCount: document.querySelectorAll('#page-portfolio #pf-analysis-status').length,
    nativePrimarySinkCount: document.querySelectorAll('#page-portfolio[data-aio-architecture-renderer="native"] #pf-analysis-status').length,
    statusValue: document.getElementById('pf-analysis-status')?.textContent || null,
    sourceKind: document.getElementById('pf-analysis-status')?.getAttribute('data-source-kind') || null,
    surfaceUse: document.getElementById('page-portfolio')?.dataset.aioPortfolioSurfaceUse || null
  }));
  if (portfolioRoute.renderer !== 'native' || portfolioRoute.heroRenderer !== 'native' || !portfolioRoute.heroValue.trim() || !portfolioRoute.heroPnl.trim() || portfolioRoute.tableRenderer !== 'native' || portfolioRoute.surfaceRenderer !== 'native' || portfolioRoute.surfaceModel !== PORTFOLIO_SURFACE_MODEL_VERSION || portfolioRoute.surfaceUse !== 'reference-only' || portfolioRoute.holdingCountRenderer !== 'native' || portfolioRoute.sectorRenderer !== 'native' || portfolioRoute.exposureRenderer !== 'native' || portfolioRoute.chartRenderer !== 'native' || !['unavailable', 'portfolio-state'].includes(portfolioRoute.chartSourceKind)) throw new Error(`portfolio hero/table/summary/chart native surface failed: ${JSON.stringify(portfolioRoute)}`);
  const portfolioMath = await page.evaluate(async () => {
    const { createPortfolioPage } = await import('/src/ui/pages/portfolio.js');
    function project(portfolio, liveData = {}) {
      const doc = document.implementation.createHTMLDocument('isolated portfolio fixture');
      doc.body.innerHTML = '<section id="page-portfolio"><span id="pf-total-value"></span><span id="pf-total-pnl"></span><span id="pf-daily-chg"></span><span id="pf-daily-pct"></span><table><tbody id="pf-positions-tbody"></tbody></table></section>';
      const store = { getState: () => ({ portfolio }), subscribe: () => () => {} };
      const dispose = createPortfolioPage({ root: { _liveData: liveData }, documentRef: doc, store }).mount();
      const result = { value: doc.getElementById('pf-total-value').textContent, pnl: doc.getElementById('pf-total-pnl').textContent, daily: doc.getElementById('pf-daily-chg').textContent, pct: doc.getElementById('pf-daily-pct').textContent, cells: [...doc.querySelectorAll('td')].map((cell) => cell.textContent) };
      dispose();
      return result;
    }
    return {
      missing: project({ holdings: [{ symbol: 'ABC', shares: 10, avgCost: null, price: 110 }], cash: 0 }),
      daily: project({ holdings: [{ symbol: 'ABC', shares: 10, avgCost: 80, price: 110, dailyPct: 10 }], cash: 0 }),
      live: project({ holdings: [{ symbol: 'ABC', shares: 10, avgCost: 80, price: 100 }], cash: 100, totals: { totalValue: 1000, totalAssets: 1100 } }, { ABC: { price: 200, pct: 0, dailyPct: 0, changeBasis: 'previous-close', observedAt: new Date(Date.now() - 1000).toISOString(), source: 'runtime-test-provider', sourceKind: 'LIVE', sourceTier: 'T2_LICENSED', rightsId: 'runtime-test-rights', revisionId: 'runtime-test-r1', allowedUse: 'decision', allowedUseCeiling: 'decision', quality: { status: 'live', freshness: 'live', timestampValid: true, ageMs: 1000, freshnessMs: 15 * 60 * 1000 } } })
    };
  });
  if (portfolioMath.missing.pnl !== '—' || portfolioMath.missing.cells[5] !== '—' || portfolioMath.daily.daily !== '—' || portfolioMath.daily.pct !== '—' || portfolioMath.live.value !== '$2,100' || portfolioMath.live.pnl !== '+$1,200' || portfolioMath.live.daily !== '$0' || !portfolioMath.live.cells.includes('$200.00')) throw new Error('portfolio valuation regression: ' + JSON.stringify(portfolioMath));
  await page.evaluate(() => window.AIO_ARCH.navigate('technical'));
  await page.waitForFunction(() => document.getElementById('page-technical')?.dataset.aioArchitectureRoute === 'technical');
  // P1420: the 0-100 health score was retired; the page shows the 시장 상태 six-axis summary and
  // leads with the stock chart, and the legacy health writer must still not paint the page.
  const technicalRoute = await page.evaluate(() => {
    window.computeMarketHealth?.();
    const pageNode = document.getElementById('page-technical');
    const order = [...(pageNode?.children || [])].map((node) => node.id).filter(Boolean);
    return {
      pageExists: !!pageNode,
      renderer: pageNode?.dataset.aioArchitectureRenderer || null,
      technicalRenderer: pageNode?.dataset.aioTechnicalRenderer || null,
      summaryRenderer: document.getElementById('tech-regime-summary')?.dataset.aioTechRegimeRenderer || null,
      overall: document.getElementById('tech-regime-overall')?.textContent || '',
      chips: document.querySelectorAll('#tech-regime-chips .regime-chip').length,
      retiredScore: !!document.getElementById('health-score-display') || !!document.getElementById('health-components'),
      chartFirst: order.indexOf('tech-regime-summary') >= 0 && order.indexOf('tech-regime-summary') < order.indexOf('stock-chart-section'),
      stockChartForm: document.getElementById('stock-chart-form')?.dataset.aioStockChart || null,
      candleTitle: document.getElementById('stock-chart-title')?.textContent || '',
      retiredCandle: !!document.getElementById('tech-candle-chart')
    };
  });
  if (technicalRoute.renderer !== 'native' || technicalRoute.technicalRenderer !== 'native' || technicalRoute.summaryRenderer !== 'native' || !technicalRoute.overall.trim() || technicalRoute.chips !== 7 || technicalRoute.retiredScore || !technicalRoute.chartFirst || technicalRoute.stockChartForm !== 'installed' || !technicalRoute.candleTitle.trim() || technicalRoute.retiredCandle) throw new Error(`P1420 technical regime summary / stock chart surface failed: ${JSON.stringify(technicalRoute)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('signal'));
  await page.waitForFunction(() => document.getElementById('page-signal')?.dataset.aioArchitectureRoute === 'signal');
  // P1392: the 시장 상태 screen is the native six-axis regime board; the legacy signal dashboard
  // writer must not overwrite it (fence), and every axis states evidence and a flip condition.
  await page.waitForFunction(() => document.querySelectorAll('#regime-board [data-axis]').length >= 6, null, { timeout: 30000 });
  const signalRoute = await page.evaluate(() => {
    const primarySelectors = '#regime-overall, #regime-basis, #regime-board';
    const overall = document.getElementById('regime-overall');
    const before = overall?.textContent || '';
    if (overall) overall.textContent = 'NATIVE-FENCE';
    window.refreshSignalDashboard?.();
    const fenceValue = { overall: overall?.textContent || '' };
    if (overall) overall.textContent = before;
    const axes = [...document.querySelectorAll('#regime-board [data-axis]')];
    return {
      pageExists: !!document.getElementById('page-signal'),
      renderer: document.getElementById('page-signal')?.dataset.aioArchitectureRenderer || null,
      signalRenderer: document.getElementById('page-signal')?.dataset.aioSignalRenderer || null,
      regimeRenderer: document.getElementById('page-signal')?.dataset.aioRegimeRenderer || null,
      rawPrimarySinkCount: document.querySelectorAll(`#page-signal ${primarySelectors}`).length,
      nativePrimarySinkCount: document.querySelectorAll(`#page-signal[data-aio-architecture-renderer="native"] ${primarySelectors}`).length,
      axes: axes.map((node) => ({ id: node.dataset.axis, state: node.dataset.state, flip: !!node.querySelector('.regime-flip'), evidence: node.querySelectorAll('dd').length })),
      retired: ['score-gauge-val', 'score-adjustments-container', 'sig-sw-btn', 'entry-check-summary'].filter((id) => document.getElementById(id)),
      overall: before,
      fenceValue
    };
  });
  if (signalRoute.renderer !== 'native' || signalRoute.signalRenderer !== 'native' || signalRoute.regimeRenderer !== 'native'
    || signalRoute.rawPrimarySinkCount !== 3 || signalRoute.nativePrimarySinkCount !== 3 || signalRoute.fenceValue.overall !== 'NATIVE-FENCE'
    || signalRoute.retired.length || !signalRoute.overall.trim()
    || signalRoute.axes.length < 6 || signalRoute.axes.some((row) => row.state !== 'unknown' && (!row.evidence || !row.flip)))
    throw new Error(`P1392 signal regime board failed: ${JSON.stringify(signalRoute)}`);
  // P1352: a blocked primary score must not become the pulse's default 50; zero remains a real observation.
  const pulseSemantics = await page.evaluate(() => {
    const original = window.computeTradingScore;
    const outcomes = [];
    try {
      for (const total of [null, 0, 75]) {
        window.computeTradingScore = () => ({ total });
        window.updateMarketPulse();
        outcomes.push({ total, text: document.getElementById('mp-signal-score')?.textContent, label: document.getElementById('mp-signal-label')?.textContent });
      }
      window.computeTradingScore = () => { throw new Error('P1352 test unavailable'); };
      window.updateMarketPulse();
      outcomes.push({ total: 'throw', text: document.getElementById('mp-signal-score')?.textContent });
    } finally { window.computeTradingScore = original; window.updateMarketPulse(); }
    return outcomes;
  });
  if (pulseSemantics[0].text !== '—' || pulseSemantics[0].label !== '산출 보류' || pulseSemantics[1].text !== '0' || pulseSemantics[2].text !== '75' || pulseSemantics[3].text !== '—') throw new Error(`P1352 pulse fabricated score: ${JSON.stringify(pulseSemantics)}`);
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
  // P1431 (supersedes P1389 order): the connected read first (conclusion), then drivers, next checks, and the schedule.
  const briefingSummary = await page.evaluate(() => {
    const schedule = document.getElementById('briefing-schedule');
    const read = document.getElementById('briefing-read');
    const checks = document.getElementById('briefing-check-list');
    return { native: document.getElementById('page-briefing')?.dataset.aioBriefingRenderer,
      readFirst: !!schedule && !!read && !!(read.compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING),
      headline: document.getElementById('briefing-read-headline')?.textContent || '',
      drivers: document.querySelectorAll('#briefing-driver-rows [data-axis]').length,
      checks: checks?.textContent || '', retired: ['briefing-decision-summary', 'briefing-market-strip', 'briefing-live-news-list'].filter((id) => document.getElementById(id)) };
  });
  if (briefingSummary.native !== 'native-read' || !briefingSummary.readFirst || !briefingSummary.headline.trim()
    || briefingSummary.retired.length || /매수|매도|BUY|SELL/.test(briefingSummary.checks + briefingSummary.headline))
    throw new Error(`P1389 briefing read failed: ${JSON.stringify(briefingSummary)}`);
  const contentRoutes = await page.evaluate(({ market, macro, fxbond, breadth, themes, themeDetail, ticker, fundamental, portfolio, technical, signal, home }) => ({
    active: window.AIO_ARCH.router.active(),
    // P770: market-news and briefing must expose native primary-feed markers; secondary AI digest
    // content remains a compatibility/narrative boundary.
    marketRenderer: market.renderer,
    marketFeedRenderer: market.feedRenderer,
    briefingRenderer: document.getElementById('page-briefing')?.dataset.aioArchitectureRenderer || null,
    briefingSlice: document.getElementById('page-briefing')?.dataset.aioArchitectureSlice || null,
    briefingFeedRenderer: document.getElementById('page-briefing')?.dataset.aioBriefingRenderer || null, // P1389: the read replaces the feed
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
    fundamentalRenderer: fundamental.renderer,
    portfolioRenderer: portfolio.renderer
    ,signalRenderer: signal.renderer
    ,signalHeroRenderer: signal.signalRenderer
    ,homeRenderer: home.renderer
    ,homeSummaryRenderer: home.homeRenderer
  }), { market: marketRoute, macro: macroRoute, fxbond: fxbondRoute, breadth: breadthRoute, themes: themesRoute, themeDetail: themeDetailRoute, ticker: tickerRoute, fundamental: fundamentalRoute, portfolio: portfolioRoute, technical: technicalRoute, signal: signalRoute, home: homeRoute });
  if (contentRoutes.active !== 'briefing' || contentRoutes.marketRenderer !== 'native' || contentRoutes.marketFeedRenderer !== 'native' || contentRoutes.briefingRenderer !== 'native' || contentRoutes.briefingSlice !== 'news' || contentRoutes.briefingFeedRenderer !== 'native-read' || contentRoutes.macroRenderer !== 'native' || contentRoutes.macroPrimaryRenderer !== 'native' || contentRoutes.fxbondRenderer !== 'native' || contentRoutes.fxbondPrimaryRenderer !== 'native' || contentRoutes.breadthRenderer !== 'native' || contentRoutes.technicalRenderer !== 'native' || contentRoutes.technicalPrimaryRenderer !== 'native' || contentRoutes.signalRenderer !== 'native' || contentRoutes.signalHeroRenderer !== 'native' || contentRoutes.homeRenderer !== 'native' || contentRoutes.homeSummaryRenderer !== 'native' || contentRoutes.themesRenderer !== 'native' || contentRoutes.themesPrimaryRenderer !== 'native' || !contentRoutes.themeDetailNativeSummary || contentRoutes.tickerRenderer !== 'native' || contentRoutes.fundamentalRenderer !== 'native' || contentRoutes.portfolioRenderer !== 'native' || macroRoute.nativeLiveSinkCount < 1 || fxbondRoute.nativeLiveSinkCount < 1 || themesRoute.rawPrimarySinkCount !== 2 || themesRoute.nativePrimarySinkCount !== 2 || tickerRoute.rawPrimarySinkCount !== 4 || tickerRoute.nativePrimarySinkCount !== 4 || tickerRoute.symbolRenderer !== 'native' || !tickerRoute.candleSymbol.trim() || tickerRoute.pnlRenderer !== 'native' || tickerRoute.pnlParentRenderer !== 'native' || tickerRoute.extensionRenderer !== 'native' || fundamentalRoute.rawPrimarySinkCount !== 1 || fundamentalRoute.nativePrimarySinkCount !== 1 || fundamentalRoute.summaryRenderer !== 'native' || !fundamentalRoute.summaryText.trim() || !fundamentalRoute.summarySourceKind || fundamentalRoute.reportRenderer !== 'native' || fundamentalRoute.reportModel !== 'sec-report.v3' || !fundamentalRoute.reportTitle.trim() || !fundamentalRoute.reportMeta.trim() || !fundamentalRoute.reportMeta.includes('PIT') || !fundamentalRoute.reportCoverage.trim() || fundamentalRoute.reportGridRenderer !== 'native' || portfolioRoute.rawPrimarySinkCount !== 1 || portfolioRoute.nativePrimarySinkCount !== 1 || portfolioRoute.tableRenderer !== 'native') throw new Error(`content route lifecycle failed: ${JSON.stringify({ contentRoutes, macroRoute, fxbondRoute, breadthRoute, technicalRoute, signalRoute, homeRoute, themesRoute, themeDetailRoute, tickerRoute, optionsRetired, fundamentalRoute, portfolioRoute })}`);

  if (breadthRoute.boardRenderer !== 'native' || breadthRoute.cards !== 10 || breadthRoute.charts !== 10 || !breadthRoute.state.trim() || breadthRoute.retired.length) throw new Error(`P1395 breadth board failed: ${JSON.stringify(breadthRoute)}`);

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
  await page.waitForFunction(() => window._aioTimerRegistry && 'dataStatus' in window._aioTimerRegistry && 'alerts-check' in window._aioTimerRegistry, { timeout: 40000 });
  const ROUTE_IDS_FOR_ROUNDTRIP = ROUTE_IDS;
  async function traverseAllRoutes() {
    for (const route of ROUTE_IDS_FOR_ROUNDTRIP) {
      await page.evaluate((r) => window.AIO_ARCH.navigate(r), route);
      // P826: theme-detail is a derived inline surface whose canonical owner is
      // the themes page. The compatibility facade intentionally replays that
      // canonical route, so the round-trip wait must assert the owner mount and
      // the visible native detail panel rather than the retired standalone page.
      const canonicalRoute = route === 'theme-detail' ? 'themes' : route;
      await page.waitForFunction((r) => document.getElementById(`page-${r}`)?.dataset.aioArchitectureRoute === r, canonicalRoute);
      const verticalMarker = await page.evaluate((r) => {
        const page = document.getElementById(`page-${r}`);
        const contract = window.AIO_ARCH.getVerticalSliceContract?.(r);
        return { marker: page?.dataset.aioVerticalSlice || null, expected: contract?.id || null, required: page?.dataset.aioVerticalSliceRequired || null, state: page?.dataset.aioVerticalSliceState || null };
      }, canonicalRoute);
      if (!verticalMarker.marker || verticalMarker.marker !== verticalMarker.expected || !verticalMarker.required && canonicalRoute !== 'guide' && canonicalRoute !== 'principles' && canonicalRoute !== 'masters' && canonicalRoute !== 'atlas' || !['loaded', 'partial', 'blocked', 'empty', 'stale-reference'].includes(verticalMarker.state)) throw new Error(`vertical slice marker failed for ${route}: ${JSON.stringify(verticalMarker)}`);
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
  // A round-trip failure used to discard the page errors collected above, so the report
  // named the symptom ("marker is null") without the cause (the mount that threw). Attach
  // them so the next reader does not have to re-derive it.
  try {
    await traverseAllRoutes();
  } catch (error) {
    if (errors.length) error.message += ` | page errors: ${errors.join(' | ')}`;
    throw error;
  }
  const afterLap1 = await snapshot();
  await traverseAllRoutes();
  const afterLap2 = await snapshot();
  if (errors.length) throw new Error(`browser errors during 20-route round trip: ${errors.join(' | ')}`);
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
  // P1392: the home card shows the regime label (the 0-100 score was retired), never a number.
  if (!['판정 대기', '우호적 환경', '대체로 우호적', '혼조 환경', '경계 환경', '방어적 환경'].includes(homeSurface.heroTotal || '')) throw new Error(`home hero regime label invalid: ${JSON.stringify(homeSurface)}`);
  if (!placeholderPattern.test(homeSurface.tradingSignal || '') && !koreanPattern.test(homeSurface.tradingSignal || '')) throw new Error(`home-trading-signal is neither a placeholder nor a Korean label: ${JSON.stringify(homeSurface)}`);

  await page.evaluate(() => window.showPage('sentiment'));
  await page.waitForFunction(() => document.getElementById('page-sentiment')?.dataset.aioArchitectureRoute === 'sentiment');
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, boot, quoteTopbar, sentimentRoute, guideRoute, contentRoutes, macroRoute, fxbondRoute, breadthRoute, technicalRoute, signalRoute, homeRoute, themesRoute, themeDetailRoute, tickerRoute, optionsRetired, fundamentalRoute, portfolioRoute, homeSurface, roundTripEvidence, routeRoundTrip: true, browserErrors: 0 }));
} finally {
  await browser.close();
  server.kill();
}
