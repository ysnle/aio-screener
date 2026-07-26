import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[architecture-contract] ${message}`); };

const golden = JSON.parse(read('architecture/golden-routes.json'));
const release = JSON.parse(read('architecture/release-manifest.json'));
const version = JSON.parse(read('version.json'));
const executionPlan = read('_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md');
const publicManifest = JSON.parse(read('public-artifact-manifest.json'));
const serviceWorkerSource = read('sw.js');
if (!Array.isArray(golden.routes) || golden.routes.length !== 17) fail('golden route count must be 17');
for (const marker of ['## 2. 계층별 현재 상태와 목표', '## 5. 17 route 세부 전환 원장', '## 7. 세션 작업 카드', 'DELETE-LEDGER', 'nativeRendererOwner', '## 9. 전체 재구축 최종 인수 기준']) {
  if (!executionPlan.includes(marker)) fail(`architecture execution plan missing marker: ${marker}`);
}
if (golden.firstVerticalSlice !== 'sentiment') fail('first vertical slice must remain sentiment');
if (!publicManifest.publicRootAllowlist.includes('src/**/*.js')) fail('Pages allowlist does not publish native ESM');
const srcFiles = fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter((file) => String(file).endsWith('.js'));
for (const file of srcFiles) {
  const asset = `./src/${String(file).replaceAll('\\', '/')}`;
  if (!serviceWorkerSource.includes(`'${asset}'`)) fail(`service worker shell asset missing: ${asset}`);
}
for (const field of ['appRevision', 'dataRevision', 'evidenceRevision']) {
  if (!release[field] || release[field] === 'unknown') fail(`release revision missing: ${field}`);
}
if (release.appRevision !== version.version) fail(`release appRevision ${release.appRevision} != version ${version.version}`);
for (const required of golden.requiredEvidenceFields) {
  if (!read('src/data/contracts/evidence.js').includes(required)) fail(`evidence field missing: ${required}`);
}

const forbiddenByLayer = {
  domain: [/\bfetch\s*\(/, /localStorage|sessionStorage|indexedDB/, /document\.|window\./],
  state: [/\bfetch\s*\(/, /localStorage|sessionStorage|indexedDB/, /document\./],
  ui: [/\bfetch\s*\(/, /localStorage|sessionStorage|indexedDB/],
  ai: [/\bfetch\s*\(/, /localStorage|sessionStorage|indexedDB/]
};
for (const [layer, patterns] of Object.entries(forbiddenByLayer)) {
  const dir = path.join(root, 'src', layer);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir, { recursive: true }).filter((file) => String(file).endsWith('.js'));
  for (const file of files) {
    const rel = path.join('src', layer, file);
    const source = read(rel);
    for (const pattern of patterns) if (pattern.test(source)) fail(`${rel} violates ${layer} boundary: ${pattern}`);
  }
}

const baseline = JSON.parse(read('architecture/baseline.json'));
const routeOwners = JSON.parse(read('architecture/route-owners.json'));
const routeEntries = Object.entries(routeOwners.routes || {});
const ownerDimensions = ['lifecycle', 'renderer', 'data', 'chart', 'narrative'];
const nativeRoutesByDimension = Object.fromEntries(ownerDimensions.map((dimension) => [
  dimension,
  routeEntries.filter(([, owner]) => owner[`${dimension}Owner`] === 'native').map(([route]) => route)
]));
const fullNativeOwner = routeEntries
  .filter(([, owner]) => ownerDimensions.every((dimension) => owner[`${dimension}Owner`] === 'native'))
  .map(([route]) => route);
const assertExactRoutes = (field, expected) => {
  const actual = routeOwners.counts?.[field];
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((route, index) => route !== expected[index])) {
    fail(`route-owners counts.${field} drifted: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
for (const [field, expected] of Object.entries({
  totalRoutes: routeEntries.length,
  lifecycleNative: nativeRoutesByDimension.lifecycle.length,
  rendererNative: nativeRoutesByDimension.renderer.length,
  dataNative: nativeRoutesByDimension.data.length,
  chartNative: nativeRoutesByDimension.chart.length,
  narrativeNative: nativeRoutesByDimension.narrative.length
})) {
  if (routeOwners.counts?.[field] !== expected) {
    fail(`route-owners counts.${field} drifted: expected ${expected}, got ${JSON.stringify(routeOwners.counts?.[field])}`);
  }
}
assertExactRoutes('rendererNativeRoutes', nativeRoutesByDimension.renderer);
assertExactRoutes('rendererLegacyRoutes', routeEntries.filter(([, owner]) => owner.rendererOwner === 'legacy').map(([route]) => route));
assertExactRoutes('dataNativeRoutes', nativeRoutesByDimension.data);
assertExactRoutes('chartNativeRoutes', nativeRoutesByDimension.chart);
assertExactRoutes('narrativeNativeRoutes', nativeRoutesByDimension.narrative);
assertExactRoutes('fullNativeOwner', fullNativeOwner);
const legacyFiles = ['index.html', 'js/aio-core.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-chat.js'];
const aggregate = legacyFiles.map((file) => read(file)).join('\n');
const count = (pattern) => (aggregate.match(pattern) || []).length;
const current = {
  explicitWindowWrites: count(/\bwindow\s*\.\s*[A-Za-z_$][\w$]*\s*=/g),
  directFetch: count(/\bfetch\s*\(/g),
  directStorage: count(/\b(?:localStorage|sessionStorage)\s*\./g),
  htmlSinks: count(/\.innerHTML\s*=/g)
};
if (process.argv.includes('--print-current')) {
  console.log(JSON.stringify(current, null, 2));
  process.exit(0);
}
for (const [name, value] of Object.entries(current)) {
  if (value > baseline[name]) fail(`${name} increased from ${baseline[name]} to ${value}`);
}
const burnDown = baseline.burnDown || {};
if (Number.isFinite(burnDown.explicitWindowWritesMax) && current.explicitWindowWrites > burnDown.explicitWindowWritesMax) {
  fail(`explicitWindowWrites burn-down target missed: ${current.explicitWindowWrites} > ${burnDown.explicitWindowWritesMax}`);
}
const dataSource = read('js/aio-data.js');
const coreSource = read('js/aio-core.js');
const uiSource = read('js/aio-ui.js');
const bootstrapSource = read('src/app/bootstrap.js');
const sentimentPageSource = read('src/ui/pages/sentiment.js');
const guidePageSource = read('src/ui/pages/guide.js');
const newsPageSource = read('src/ui/pages/news.js');
const marketPageSource = read('src/ui/pages/market.js');
const entityPageSource = read('src/ui/pages/entity.js');
const portfolioPageSource = read('src/ui/pages/portfolio.js');
const analysisPageSource = read('src/ui/pages/analysis.js');
const themesPageSource = read('src/ui/pages/themes.js');
const marketHealthSource = read('src/domain/market/health.js');
if (!bootstrapSource.includes('const ingestSentiment') || !bootstrapSource.includes('ingestSentiment,')) fail('sentiment canonical ingest gateway missing');
if (!dataSource.includes('AIO_ARCH.ingestSentiment')) fail('legacy sentiment producer gateway notification missing');
if (burnDown.retiredDataShowPageMonkeyPatch && (/const originalShowPage\s*=\s*window\.showPage/.test(dataSource) || /window\.showPage\s*=\s*function\s*\(pageId/.test(dataSource))) {
  fail('retired aio-data showPage monkey patch returned');
}
if (burnDown.retiredSentimentLegacyInitHook && !/'sentiment':\s*\{[^\n]*init:\s*null/.test(coreSource)) {
  fail('sentiment legacy PAGES init hook returned');
}
if (burnDown.retiredSentimentLegacyBadgeWriter && /badge\.textContent\s*=\s*'심리:/.test(uiSource)) {
  fail('sentiment legacy badge writer returned');
}
// R352/F-01 ratchet: legacy symbols that must be absent are declared once in route-owners.json
// (the single ownership source of truth) and enforced for every renderer-native route here,
// instead of a hardcoded per-route array that can silently drift out of sync (F-02).
for (const [route, symbols] of Object.entries(routeOwners.legacySymbolsMustBeAbsent || {})) {
  for (const symbol of symbols) {
    if (aggregate.includes(symbol)) fail(`retired legacy symbol returned for native renderer route ${route}: ${symbol}`);
  }
}
for (const [route, symbols] of Object.entries(routeOwners.retiredLegacySymbolsMustBeAbsent || {})) {
  for (const symbol of symbols) {
    if (aggregate.includes(symbol)) fail(`retired legacy symbol returned for derived route ${route}: ${symbol}`);
  }
}
for (const [route, patterns] of Object.entries(routeOwners.legacySymbolPatternsMustBeAbsent || {})) {
  for (const pattern of patterns) {
    if (new RegExp(pattern).test(aggregate)) fail(`retired legacy pattern returned for native renderer route ${route}: ${pattern}`);
  }
}
for (const marker of ['createResourceBag', "dataset.aioArchitectureRenderer = 'native'", 'renderSentiment']) {
  if (!sentimentPageSource.includes(marker)) fail(`native sentiment renderer marker missing: ${marker}`);
}
for (const [name, source, markers] of [
  ['guide', guidePageSource, ['createResourceBag', "dataset.aioArchitectureRenderer = 'native'", 'searchGuide']]
]) {
  for (const marker of markers) if (!source.includes(marker)) fail(`native ${name} renderer marker missing: ${marker}`);
}
// P770: news.js owns the primary market-news and briefing feed renderers; secondary AI digest
// content remains a compatibility/narrative boundary.
if (!newsPageSource.includes("page.dataset.aioArchitectureRenderer = 'native'")) fail('news.js native market-news renderer marker missing');
if (!newsPageSource.includes("container.dataset.aioNewsRenderer = 'native'")) fail('news.js native feed marker missing');
if (!newsPageSource.includes("container.dataset.aioBriefingRenderer = 'native'")) fail('news.js native briefing feed marker missing');
if (newsPageSource.includes('renderStories')) fail('news.js content-rendering helper (renderStories) returned after RM-01 removed it');
// P771: market.js owns macro primary quote/FRED metric sinks. The legacy global passes must
// retain an explicit native-element fence so a later refresh cannot win by last-writer timing.
if (!marketPageSource.includes("page.dataset.aioArchitectureRenderer = 'native'") || !marketPageSource.includes('renderLiveQuotes') || !marketPageSource.includes('renderSnapshotMetrics')) fail('market.js native macro primary renderer marker missing');
if (!marketPageSource.includes("page.dataset.aioFxbondRenderer = 'native'") || !marketPageSource.includes('renderFxbond')) fail('market.js native fxbond primary renderer marker missing');
if (!dataSource.includes('function _aioIsNativeMacroElement') || !dataSource.includes('_aioIsNativeMacroElement(el)') || !dataSource.includes('function _aioIsNativeFxbondElement')) fail('legacy macro/fxbond native-element writer fence missing');
if (!read('index.html').includes("el.closest('#page-fxbond[data-aio-architecture-renderer=\"native\"]')")) fail('legacy inline MOVE snapshot writer fence missing');
// P804: market.js owns the bounded FX/bond risk pill from DXY and US 10Y evidence;
// the legacy fxbond updater remains a fenced compatibility path.
if (!marketPageSource.includes('fxbond-risk-pill') || !marketPageSource.includes('aioFxbondRiskRenderer')) fail('native fxbond risk renderer marker missing');
if (!read('index.html').includes("pill.dataset.aioFxbondRiskRenderer !== 'native'")) fail('legacy fxbond risk pill writer fence missing');
// P805: market.js owns the bounded 3M/10Y curve inversion badge; the legacy curve updater is fenced.
if (!marketPageSource.includes('yc-inversion-badge') || !marketPageSource.includes('aioFxbondCurveRenderer')) fail('native fxbond curve renderer marker missing');
if (!read('index.html').includes("invBadge.dataset.aioFxbondCurveRenderer !== 'native'")) fail('legacy fxbond inversion writer fence missing');
// P807: market.js owns only the bounded carry-risk-level label; the legacy composite proxy is fenced.
if (!marketPageSource.includes('carry-risk-level') || !marketPageSource.includes('aioFxbondCarryRenderer')) fail('native fxbond carry renderer marker missing');
if (!dataSource.includes('aioFxbondCarryRenderer') || !dataSource.includes("dataset.aioFxbondCarryRenderer !== 'native'")) fail('legacy fxbond carry writer fence missing');
if (!marketPageSource.includes('yc-2y-track') || !marketPageSource.includes('aioFxbondTwoYearRenderer')) fail('native fxbond 2Y renderer marker missing');
if (!dataSource.includes('aioFxbondTwoYearRenderer')) fail('legacy fxbond 2Y writer fence missing');
// P812: the bounded FX/bond carry score surface is native; the legacy score/bar/verdict
// writers were deleted while the carry-risk-level compatibility boundary remains explicit.
for (const marker of ['carry-score-text', 'carry-score-bar', 'carry-verdict', 'aioFxbondCarryScoreRenderer']) {
  if (!marketPageSource.includes(marker)) fail(`native fxbond carry score marker missing: ${marker}`);
}
if (dataSource.includes("document.getElementById('carry-score-text')") || dataSource.includes("document.getElementById('carry-score-bar')") || dataSource.includes("document.getElementById('carry-verdict')")) fail('legacy fxbond carry score writer returned after P812 cutover');
// P813: the integrated cross-asset verdict is native; the legacy matrix keeps its
// individual compatibility cells but no longer writes the aggregate verdict.
if (!marketPageSource.includes('cam-verdict-text') || !marketPageSource.includes('aioFxbondCamRenderer')) fail('native fxbond CAM renderer marker missing');
if (read('index.html').includes("document.getElementById('cam-verdict-text')")) fail('legacy fxbond CAM verdict writer returned after P813 cutover');
// P814: the fxbond curve chart status label is native; the chart canvas itself remains
// a legacy compatibility surface and the old status writer must stay deleted.
if (!marketPageSource.includes('yc-chart-status') || !marketPageSource.includes('aioFxbondCurveStatusRenderer')) fail('native fxbond curve status marker missing');
if (read('index.html').includes("document.getElementById('yc-chart-status')")) fail('legacy fxbond curve status writer returned after P814 cutover');
if (!marketPageSource.includes("page.dataset.aioBreadthRenderer = 'native'") || !marketPageSource.includes('renderBreadth')) fail('market.js native breadth primary renderer marker missing');
if (!dataSource.includes('function _aioIsNativeBreadthElement') || !dataSource.includes('_aioIsNativeBreadthElement(el)') || !uiSource.includes('_aioIsNativeBreadthElement(el)') || !coreSource.includes('#page-breadth[data-aio-architecture-renderer="native"]')) fail('legacy breadth native-element writer fence missing');
// P806: market.js owns the bounded 2s10s summary surfaces from explicit 2Y/10Y evidence;
// the legacy yield-curve updater cannot overwrite spread-status once marked native.
if (!marketPageSource.includes('macro-spread-value') || !marketPageSource.includes('aioMacroSpreadRenderer')) fail('native macro spread renderer marker missing');
if (!read('index.html').includes('blockedSpread.dataset.aioMacroSpreadRenderer') || !read('index.html').includes('nativeSpread')) fail('legacy macro spread writer fence missing');
if (!marketPageSource.includes('macro-2y-value') || !marketPageSource.includes('aioMacroTwoYearRenderer')) fail('native macro 2Y renderer marker missing');
// P811: market.js owns the bounded curve status/meaning labels; the legacy yield-curve
// function retains chart compatibility but must not reintroduce the prose writers.
if (!marketPageSource.includes('curve-status') || !marketPageSource.includes('curve-meaning') || !marketPageSource.includes('aioMacroCurveRenderer')) fail('native macro curve renderer marker missing');
if (read('index.html').includes("document.getElementById('curve-status')") || read('index.html').includes("document.getElementById('curve-meaning')")) fail('legacy macro curve status/meaning writer returned after P811 cutover');
// P816: market.js owns the bounded Fed/FOMC context line; event freshness keeps
// compatibility metadata but must not overwrite the native macro sink.
for (const marker of ['macro-fed-meaning', 'aioMacroFedMeaningRenderer', 'AIO_EVENT_FRESHNESS_REGISTRY']) {
  if (!marketPageSource.includes(marker)) fail(`native macro Fed meaning renderer marker missing: ${marker}`);
}
if (!coreSource.includes("fed.dataset.aioMacroFedMeaningRenderer !== 'native'")) fail('legacy macro Fed meaning writer fence missing');
// P817: entity.js owns the ticker candle/entry symbol labels from normalized entity id;
// showTicker remains a compatibility path but must skip the native-marked sinks.
for (const marker of ['renderTickerSecondarySymbols', 'ticker-candle-symbol', 'ticker-entry-symbol', 'aioTickerSymbolRenderer']) {
  if (!entityPageSource.includes(marker)) fail(`native ticker symbol renderer marker missing: ${marker}`);
}
if (!coreSource.includes("_tcs.dataset.aioTickerSymbolRenderer !== 'native'") || !coreSource.includes("_tes.dataset.aioTickerSymbolRenderer !== 'native'")) fail('legacy ticker symbol writer fence missing');
// P818: themes.js owns the derived detail-panel display/current-theme marker after
// the compatibility event; inline selection/close helpers retain only compatibility
// selection/event behavior and must not write the panel DOM.
for (const marker of ['theme-detail-panel', 'aioThemeDetailPanelRenderer', 'onThemeDetailShown', 'onThemeDetailClosed']) {
  if (!themesPageSource.includes(marker)) fail(`native theme detail panel marker missing: ${marker}`);
}
const indexHtmlSource = read('index.html');
const showThemeDetailSource = indexHtmlSource.slice(indexHtmlSource.indexOf('function showThemeDetail'), indexHtmlSource.indexOf('var _retiredThemeDeepAnalysis'));
const closeThemeDetailSource = indexHtmlSource.slice(indexHtmlSource.indexOf('function closeThemeDetail'), indexHtmlSource.indexOf('function showSubThemeDetail'));
if (showThemeDetailSource.includes("container.style.display = 'block'") || showThemeDetailSource.includes("container.dataset.currentTheme = themeId") || closeThemeDetailSource.includes("p.style.display = 'none'")) fail('legacy theme detail panel writer returned after P818 cutover');
// P803: market.js owns the bounded breadth signal label from the normalized advance ratio;
// the legacy RSP/SPY signal writer must not overwrite the native element.
if (!marketPageSource.includes('breadth-signal-val') || !marketPageSource.includes('aioBreadthSignalRenderer')) fail('native breadth signal renderer marker missing');
if (!dataSource.includes("querySelector('[id=\"breadth-signal-val\"]')") || !dataSource.includes('aioBreadthSignalRenderer') || !dataSource.includes("dataset.aioBreadthSignalRenderer !== 'native'")) fail('legacy breadth signal writer fence missing');
// P777/P778/P779: entity.js owns the ticker hero, bounded options replacement metrics, and the
// bounded fundamental SEC source-status surface. Fundamental report and ticker secondary surfaces
// stay legacy until their own packets.
for (const marker of ['renderTickerHero', "route === 'ticker'", "routeNode.dataset.aioArchitectureRenderer = 'native'"]) {
  if (!entityPageSource.includes(marker)) fail(`native ticker hero renderer marker missing: ${marker}`);
}
for (const marker of ['renderOptions', "route === 'options'", 'opt-vix-val-secondary', 'opt-pcr-val-secondary', 'opt-skew-val-secondary']) {
  if (!entityPageSource.includes(marker)) fail(`native options renderer marker missing: ${marker}`);
}
for (const marker of ['renderFundamentalStatus', "route === 'fundamental'", 'fund-data-status', 'data-source-kind']) {
  if (!entityPageSource.includes(marker)) fail(`native fundamental status renderer marker missing: ${marker}`);
}
// P815: the bounded SEC-derived fundamental summary is native; the former inline
// aggregate report entry point is inert and must not reacquire the surface.
for (const marker of ['renderFundamentalSummary', 'fund-analysis-text', 'aioFundamentalSummaryRenderer', 'SEC']) {
  if (!entityPageSource.includes(marker)) fail(`native fundamental summary renderer marker missing: ${marker}`);
}
if (read('index.html').includes("document.getElementById('fund-analysis-text')") || read('index.html').includes('_generateFundamentalAnalysis(FUND_FALLBACK')) fail('legacy fundamental summary writer returned after P815 cutover');
// P819: market.js owns the current-evidence breadth diagnostic signal/text;
// updateBreadthBars remains compatibility-only for these marked sinks.
for (const marker of ['breadth-diag-signal', 'breadth-diag-text', 'aioBreadthDiagnosticRenderer']) {
  if (!marketPageSource.includes(marker)) fail(`native breadth diagnostic renderer marker missing: ${marker}`);
}
const breadthUiSource = read('js/aio-ui.js');
if (!breadthUiSource.includes("diagEl.dataset.aioBreadthDiagnosticRenderer !== 'native'") || !breadthUiSource.includes("breadthDiagSignal.dataset.aioBreadthDiagnosticRenderer !== 'native'") || !breadthUiSource.includes("breadthDiagText.dataset.aioBreadthDiagnosticRenderer !== 'native'")) fail('legacy breadth diagnostic writer fences missing');
// P820: analysis.js owns the home Fear & Greed score from normalized sentiment;
// the legacy dashboard keeps the label but must skip the native score sink.
for (const marker of ['renderHomeFearGreed', 'home-fg-score', 'aioHomeFearGreedRenderer', 'selectSentimentValues']) {
  if (!analysisPageSource.includes(marker)) fail(`native home Fear & Greed renderer marker missing: ${marker}`);
}
if (!dataSource.includes('[id="home-fg-score"]') || !dataSource.includes('aioHomeFearGreedRenderer')) fail('legacy home Fear & Greed writer fence missing');
// P821: the home quality card must not reuse tradingScore under a different label. Native
// owns the complete card and displays a fail-closed state until canonical quality inputs exist.
for (const marker of ['renderHomeQuality', 'home-quality-meter', 'home-quality-score', 'home-quality-label', 'aioHomeQualityRenderer']) {
  if (!analysisPageSource.includes(marker)) fail(`native home quality renderer marker missing: ${marker}`);
}
if (dataSource.includes('home-quality-meter') || dataSource.includes('home-quality-score') || dataSource.includes('home-quality-label')) fail('legacy home quality writer returned after P821 cutover');
// P822: analysis.js owns only the technical candle title/meta text. The legacy chart keeps
// canvas lifecycle and indicator math but must not reintroduce stale/loading metadata writes.
for (const marker of ['renderTechnicalCandleMeta', 'tech-candle-title', 'tech-candle-meta', 'aioTechnicalCandleMetaRenderer']) {
  if (!analysisPageSource.includes(marker)) fail(`native technical candle metadata marker missing: ${marker}`);
}
const technicalHtmlSource = read('index.html');
if (technicalHtmlSource.includes("titleEl.textContent = symbol + ' 일봉 캔들 · 이동평균'") || technicalHtmlSource.includes("metaEl.textContent = '수신 중…'") || technicalHtmlSource.includes("metaEl.textContent = last.time + ' 종가 '")) fail('legacy technical candle metadata writer returned after P822 cutover');
for (const marker of ['renderPortfolioStatus', 'pf-analysis-status', "page.dataset.aioArchitectureRenderer = 'native'"]) {
  if (!portfolioPageSource.includes(marker)) fail(`native portfolio status renderer marker missing: ${marker}`);
}
// P810: portfolio.js owns only the bounded total-value/P&L hero sinks; the legacy summary
// calculator remains active for the other portfolio cards and must not overwrite these ids.
for (const marker of ['renderPortfolioHero', 'pf-total-value', 'pf-total-pnl', 'aioPortfolioHeroRenderer']) {
  if (!portfolioPageSource.includes(marker)) fail(`native portfolio hero renderer marker missing: ${marker}`);
}
if (read('index.html').includes("document.getElementById('pf-total-value')") || read('index.html').includes("document.getElementById('pf-total-pnl')")) fail('legacy portfolio hero writer returned after P810 cutover');
if (!dataSource.includes('function _aioIsNativeMacroElement') || !dataSource.includes('#page-options[data-aio-architecture-renderer="native"]') || !coreSource.includes('#page-options[data-aio-architecture-renderer="native"]') || !read('index.html').includes('_aioIsNativeMacroElement(el)')) fail('legacy options native-element writer fence missing');
// P785: technical owns only the market-health primary surface. The pure model is the single
// formula owner; both legacy compatibility entry points must consult the native technical fence.
for (const marker of ['MARKET_HEALTH_MODEL_VERSION', 'export function computeMarketHealth', 'bars:', 'details:']) {
  if (!marketHealthSource.includes(marker)) fail(`market-health model marker missing: ${marker}`);
}
for (const marker of ['renderTechnicalHealth', "page.dataset.aioTechnicalRenderer = 'native'", 'health-score-display', 'health-interpretation']) {
  if (!analysisPageSource.includes(marker)) fail(`native technical health renderer marker missing: ${marker}`);
}
const htmlSource = read('index.html');
if (!htmlSource.includes('function _aioIsNativeTechnicalHealth') || !htmlSource.includes('window.AIO_ARCH.computeMarketHealth') || !htmlSource.includes('_aioIsNativeTechnicalHealth()')) fail('legacy technical health model/fence missing');
if (!coreSource.includes('nativeTechnicalHealth') || !coreSource.includes('window._aioIsNativeTechnicalHealth')) fail('legacy technical initializer fence missing');
// P786: signal owns only the score/decision hero. The legacy dashboard remains active for
// secondary score bars, execution-window widgets, risk monitor, and narrative, but its three
// primary text sinks must be fenced when the native signal marker is present.
for (const marker of ['deriveTradingScoreDecisionPresentation', 'SIGNAL_PRESENTATION_MODEL_VERSION']) {
  if (!analysisPageSource.includes(marker) && !read('src/domain/signal/trading-score.js').includes(marker)) fail(`signal presentation model marker missing: ${marker}`);
}
for (const marker of ['renderSignalDecision', "page.dataset.aioSignalRenderer = 'native'", 'score-gauge-val', 'score-decision-badge', 'score-decision-sub']) {
  if (!analysisPageSource.includes(marker)) fail(`native signal hero renderer marker missing: ${marker}`);
}
if (!htmlSource.includes('function _aioIsNativeSignalHero') || !htmlSource.includes('_aioIsNativeSignalHero()')) fail('legacy signal hero writer fence missing');
// P787: home owns only the four score/decision summary sinks. The quality meter, Fear & Greed,
// regime, factor detail, chart, and narrative surfaces remain compatibility-owned.
for (const marker of ['renderHomeSummary', "page.dataset.aioHomeRenderer = 'native'", 'home-hero-total', 'home-hero-headline', 'home-hero-desc', 'home-trading-signal']) {
  if (!analysisPageSource.includes(marker)) fail(`native home summary renderer marker missing: ${marker}`);
}
if (!dataSource.includes('function _aioIsNativeHomeSummaryElement') || !dataSource.includes('_aioIsNativeHomeSummaryElement(totalEl)') || !dataSource.includes('_aioIsNativeHomeSummaryElement(signalEl)')) fail('legacy home summary writer fence missing');

// P788-P797: the derived theme-detail panel keeps an empty compatibility child while
// explicit native children own the selected summary, composition/breadth, leaders, temperature,
// spread, breadth-health, subtheme-gap, benchmark, and insight narrative.
for (const marker of ['renderThemeDetailSummary', 'renderThemeDetailComposition', 'renderThemeDetailLeaders', 'renderThemeDetailTemperature', 'renderThemeDetailSpread', 'renderThemeDetailBreadthHealth', 'renderThemeDetailSubthemeGap', 'renderThemeDetailBenchmark', 'renderThemeDetailInsights', 'theme-detail-native-summary', 'theme-detail-native-composition', 'theme-detail-native-leaders', 'theme-detail-native-temperature', 'theme-detail-native-spread', 'theme-detail-native-breadth-health', 'theme-detail-native-subtheme-gap', 'theme-detail-native-benchmark', 'theme-detail-native-insights', 'aio:themeDetailShown', 'aio:themeDetailClosed']) {
  if (!themesPageSource.includes(marker)) fail(`native theme-detail surface marker missing: ${marker}`);
}
for (const marker of ['theme-detail-native-summary', 'theme-detail-native-composition', 'theme-detail-native-leaders', 'theme-detail-native-temperature', 'theme-detail-native-spread', 'theme-detail-native-breadth-health', 'theme-detail-native-subtheme-gap', 'theme-detail-native-benchmark', 'theme-detail-native-insights', 'theme-detail-legacy-content', 'aio:themeDetailShown', 'aio:themeDetailClosed']) {
  if (!htmlSource.includes(marker)) fail(`theme-detail legacy/native child boundary missing: ${marker}`);
}
if (!htmlSource.includes('P789: sub-theme composition and breadth are owned by the native child surface.')) fail('theme-detail legacy composition fence missing');
if (!htmlSource.includes('P790: detailed leader cards are owned by the native child surface.')) fail('theme-detail legacy leader fence missing');
if (!htmlSource.includes('P791: theme temperature is owned by the native child surface.')) fail('theme-detail legacy temperature fence missing');
if (!htmlSource.includes('P792: leader performance spread is owned by the native child surface.')) fail('theme-detail legacy spread fence missing');
if (!htmlSource.includes('P793: breadth-health narrative is owned by the native child surface.')) fail('theme-detail legacy breadth-health fence missing');
if (!htmlSource.includes('P794: the subtheme-gap narrative is owned by the native child surface.')) fail('theme-detail legacy subtheme-gap fence missing');
if (!htmlSource.includes('P795: benchmark comparison is owned by the native child surface.')) fail('theme-detail legacy benchmark fence missing');
if (!htmlSource.includes('P796: theme-specific insight narrative is owned by the native child surface.')) fail('theme-detail legacy insight fence missing');
if (!htmlSource.includes('P797: all visible theme-detail content is owned by the native child surfaces.') || !htmlSource.includes('legacyContainer.replaceChildren()') || htmlSource.includes('legacyContainer.innerHTML = html')) fail('theme-detail legacy visible writer retirement missing');

// P798-P799: the RRG status and canvas are native projections of the normalized themes slice.
// Legacy drawRRG remains only as a compatibility fallback and must fence both surfaces.
for (const marker of ['renderRRGStatus', 'renderRRGCanvas', 'rrg-chart-status', 'rrg-canvas', 'aioRrgStatusRenderer', 'aioRrgChartRenderer']) {
  if (!themesPageSource.includes(marker)) fail(`native RRG surface marker missing: ${marker}`);
}
if (!htmlSource.includes('P798: RRG chart-status is owned by the native themes state projection; the canvas remains legacy.') || !htmlSource.includes('P799: native themes owns the RRG canvas from normalized quadrant evidence.') || !htmlSource.includes("st.dataset.aioRrgStatusRenderer !== 'native'") || !htmlSource.includes("dataset.aioRrgChartRenderer === 'native'")) fail('RRG legacy writer fences missing');

// P800: the themes slice must be fed by the native provider/orchestrator rather than
// the legacy facade projection; legacy theme events remain compatibility notifications.
if (routeOwners.routes?.themes?.dataOwner === 'native' && (!bootstrapSource.includes('readLiveData: () => root?._liveData || {}') || bootstrapSource.includes('createThemesProvider({ read: legacy.readThemes })')) ) fail('native themes data provider boundary missing');
for (const marker of ['renderThemeCyclePill', 'theme-cycle-pill', 'aioThemeCycleRenderer']) {
  if (!themesPageSource.includes(marker)) fail(`native theme cycle marker missing: ${marker}`);
}
if (!htmlSource.includes('P801: the RRG-derived cycle pill is native; legacy sector prose must not overwrite it.') || !htmlSource.includes("pill.dataset.aioThemeCycleRenderer !== 'native'")) fail('theme cycle legacy writer fence missing');
for (const marker of ['renderThemePerformanceNarrative', 'sector-perf-analysis', 'aioThemePerformanceRenderer']) {
  if (!themesPageSource.includes(marker)) fail(`native theme performance marker missing: ${marker}`);
}
if (!htmlSource.includes('P802: normalized themes owns the bounded sector-performance narrative.') || !htmlSource.includes("el.dataset.aioThemePerformanceRenderer === 'native'")) fail('theme performance legacy writer fence missing');

// AG-DOM-WRITER (RM-01): src/ui/pages/* may only write ids/helpers that no legacy file also
// writes. This is deliberately id-based (getElementById + the setText/text(documentRef, id, …)
// helper idiom every page module uses) rather than a full DOM-write AST analysis; attribute-selector
// writes (e.g. sentiment's `[data-live-price="^VIX9D"]`) are a known gap for a future gate.
// page-* route container ids are excluded: both native (dataset stamping) and legacy (show/hide)
// legitimately locate the same container element without that being a content-write race.
function extractWrittenIds(source) {
  const ids = new Set();
  const directPattern = /getElementById\(\s*['"]([a-z][a-z0-9-]+)['"]\s*\)/g;
  const helperPattern = /\b(?:setText|text)\(\s*documentRef\s*,\s*['"]([a-z][a-z0-9-]+)['"]/g;
  for (const pattern of [directPattern, helperPattern]) {
    let match;
    while ((match = pattern.exec(source))) if (!match[1].startsWith('page-')) ids.add(match[1]);
  }
  return ids;
}
const nativePagesDir = path.join(root, 'src/ui/pages');
const nativeWrittenIds = new Map();
for (const file of fs.readdirSync(nativePagesDir).filter((entry) => entry.endsWith('.js'))) {
  for (const id of extractWrittenIds(read(path.join('src/ui/pages', file)))) {
    if (!nativeWrittenIds.has(id)) nativeWrittenIds.set(id, file);
  }
}
const legacyWrittenIds = new Set();
for (const file of legacyFiles) for (const id of extractWrittenIds(read(file))) legacyWrittenIds.add(id);
const domWriterAllowlist = new Set(routeOwners.domWriterIntersectionAllowlist || []);
const domWriterIntersection = [...nativeWrittenIds.keys()].filter((id) => legacyWrittenIds.has(id) && !domWriterAllowlist.has(id));
if (domWriterIntersection.length) {
  fail(`AG-DOM-WRITER: native/legacy id intersection is not empty: ${domWriterIntersection.map((id) => `${id} (${nativeWrittenIds.get(id)})`).join(', ')}`);
}

const modules = await Promise.all([
  import(pathToFileURL(path.join(root, 'src/data/contracts/evidence.js'))),
  import(pathToFileURL(path.join(root, 'src/data/evidence-store.js'))),
  import(pathToFileURL(path.join(root, 'src/domain/sentiment/metrics.js'))),
  import(pathToFileURL(path.join(root, 'src/state/store.js'))),
  import(pathToFileURL(path.join(root, 'src/state/slices/sentiment.js'))),
  import(pathToFileURL(path.join(root, 'src/state/selectors/sentiment.js'))),
  import(pathToFileURL(path.join(root, 'src/app/commands/sentiment.js'))),
  import(pathToFileURL(path.join(root, 'src/data/contracts/revision.js'))),
  import(pathToFileURL(path.join(root, 'src/data/quality/lineage.js'))),
  import(pathToFileURL(path.join(root, 'src/data/contracts/market-snapshot.js'))),
  import(pathToFileURL(path.join(root, 'src/ai/policy.js'))),
  import(pathToFileURL(path.join(root, 'src/ai/inference.js'))),
  import(pathToFileURL(path.join(root, 'src/platform/http.js'))),
  import(pathToFileURL(path.join(root, 'src/platform/storage.js'))),
  import(pathToFileURL(path.join(root, 'src/platform/sanitizer.js')))
]);
const [{ createEvidence, validateEvidence }, { createEvidenceStore }, { deriveSentimentSummary }, { createStore }, { createInitialSentimentState, sentimentReducer }, { selectSentimentValue }, { createSentimentCommands }, { createRevisionManifest, validateRevisionManifest }, { createLineageRecord, validateLineageRecord }, { createMarketSnapshot, validateMarketSnapshot }, { evaluateClaim }, { createInferredClaim, validateInferredClaim, evaluateInferredClaim }, { createHttpClient }, { createStorageGateway }, { createSanitizer }] = modules;
const evidence = createEvidence({ metric: 'fearGreed', value: 42, unit: 'score', sourceKind: 'fixture', observedAt: '2026-07-18T00:00:00Z', fetchedAt: '2026-07-18T00:00:01Z', status: 'live' });
if (!validateEvidence(evidence).ok || evidence.allowedUse !== 'decision') fail('live evidence contract failed');
const store = createEvidenceStore();
store.ingest(evidence);
if (store.get('fearGreed')?.evidenceId !== evidence.evidenceId) fail('evidence store read-back failed');
const summary = deriveSentimentSummary({ fearGreed: 42, vix9d: 18, vix: 17, vix3m: 20, vix6m: 22 });
if (summary.blocked || summary.vixTermStructure.regime !== '콘탱고') fail('sentiment domain contract failed');
const { createSentimentProvider } = await import(pathToFileURL(path.join(root, 'src/data/providers/sentiment.js')));
const { createSentimentOrchestrator } = await import(pathToFileURL(path.join(root, 'src/data/orchestrators/sentiment.js')));
const { createNewsProvider } = await import(pathToFileURL(path.join(root, 'src/data/providers/news.js')));
const { createNewsOrchestrator } = await import(pathToFileURL(path.join(root, 'src/data/orchestrators/news.js')));
const { createInitialNewsState, newsReducer } = await import(pathToFileURL(path.join(root, 'src/state/slices/news.js')));
const { createNewsCommands } = await import(pathToFileURL(path.join(root, 'src/app/commands/news.js')));
const { selectNewsItems } = await import(pathToFileURL(path.join(root, 'src/state/selectors/news.js')));
const { createInitialMarketState, marketReducer } = await import(pathToFileURL(path.join(root, 'src/state/slices/market.js')));
const { createMarketCommands } = await import(pathToFileURL(path.join(root, 'src/app/commands/market.js')));
const { createMarketProvider } = await import(pathToFileURL(path.join(root, 'src/data/providers/market.js')));
const { createMarketOrchestrator } = await import(pathToFileURL(path.join(root, 'src/data/orchestrators/market.js')));
const { selectMarketQuote } = await import(pathToFileURL(path.join(root, 'src/state/selectors/market.js')));
const { createInitialThemesState, themesReducer } = await import(pathToFileURL(path.join(root, 'src/state/slices/themes.js')));
const { createThemesCommands } = await import(pathToFileURL(path.join(root, 'src/app/commands/themes.js')));
const { createThemesProvider } = await import(pathToFileURL(path.join(root, 'src/data/providers/themes.js')));
const { createThemesOrchestrator } = await import(pathToFileURL(path.join(root, 'src/data/orchestrators/themes.js')));
const { selectThemesItems, selectSelectedThemeDetail } = await import(pathToFileURL(path.join(root, 'src/state/selectors/themes.js')));
const writerEvidenceStore = createEvidenceStore();
const writerStore = createStore({ initialState: { sentiment: createInitialSentimentState() }, reducer: (state, action) => ({ ...state, sentiment: sentimentReducer(state.sentiment, action) }) });
const writerCommands = createSentimentCommands({ store: writerStore });
const writer = createSentimentOrchestrator({
  provider: createSentimentProvider({ read: () => ({ fearGreed: 0, vix9d: 18, vix: 17, vix3m: 20, vix6m: 22, now: '2026-07-19T00:00:00Z' }) }),
  evidenceStore: writerEvidenceStore,
  store: writerStore,
  commands: writerCommands,
  snapshotEvidence: new Map(),
  clock: { now: () => Date.parse('2026-07-19T00:00:00Z') }
});
writer.sync();
if (selectSentimentValue(writerStore.getState(), 'fearGreed') !== 0 || writerEvidenceStore.get('vix')?.value !== 17) fail('sentiment provider/normalize/orchestrator writer contract failed');
writer.sync({ fearGreed: 77, fearGreedSourceKind: 'live', fearGreedSource: 'fixture-live', fearGreedObservedAt: '2026-07-19T00:00:00Z' });
if (selectSentimentValue(writerStore.getState(), 'fearGreed') !== 77 || writerEvidenceStore.get('fearGreed')?.source !== 'fixture-live') fail('sentiment ingest patch gateway contract failed');
const newsStore = createStore({ initialState: { news: createInitialNewsState() }, reducer: (state, action) => ({ ...state, news: newsReducer(state.news, action) }) });
const newsCommands = createNewsCommands({ store: newsStore });
const newsWriter = createNewsOrchestrator({ provider: createNewsProvider({ read: () => [{ title: 'Fixture headline', source: 'fixture', score: 50 }] }), commands: newsCommands });
newsWriter.sync();
if (selectNewsItems(newsStore.getState()).length !== 1 || selectNewsItems(newsStore.getState())[0].source !== 'fixture') fail('news provider/normalize/orchestrator writer contract failed');
const marketStore = createStore({ initialState: { market: createInitialMarketState() }, reducer: (state, action) => ({ ...state, market: marketReducer(state.market, action) }) });
const marketCommands = createMarketCommands({ store: marketStore });
const marketWriter = createMarketOrchestrator({ provider: createMarketProvider({ read: () => ({ quotes: { '^TNX': { value: 4.2, pct: 0.1 } }, metrics: { fedRate: 5.25 } }) }), commands: marketCommands });
marketWriter.sync();
if (selectMarketQuote(marketStore.getState(), '^TNX')?.value !== 4.2) fail('market provider/normalize/orchestrator writer contract failed');
const themesStore = createStore({ initialState: { themes: createInitialThemesState() }, reducer: (state, action) => ({ ...state, themes: themesReducer(state.themes, action) }) });
const themesCommands = createThemesCommands({ store: themesStore });
const themesWriter = createThemesOrchestrator({ provider: createThemesProvider({ read: () => ({
  items: [{ id: 'fixture-theme', symbol: 'ETF', pct: 1.2, quadrant: 'leading' }],
  selectedId: 'fixture-detail',
  selectedDetail: {
    id: 'fixture-detail',
    label: 'Fixture Theme',
    leaderHighlight: ['AAA'],
    leaders: ['AAA', 'BBB'],
    breadth: 50,
    quotes: { AAA: { price: 10, pct: 1 }, BBB: { price: 9, pct: -1 } },
    subThemes: [{ name: 'Fixture Subtheme', tickers: ['AAA'], weights: { AAA: 1 } }],
    source: 'fixture'
  }
}) }), commands: themesCommands });
themesWriter.sync();
if (selectThemesItems(themesStore.getState()).length !== 1 || selectThemesItems(themesStore.getState())[0].symbol !== 'ETF' || selectSelectedThemeDetail(themesStore.getState())?.id !== 'fixture-detail' || selectSelectedThemeDetail(themesStore.getState())?.breadth !== 50 || selectSelectedThemeDetail(themesStore.getState())?.quotes?.AAA?.pct !== 1 || selectSelectedThemeDetail(themesStore.getState())?.subThemes?.[0]?.weights?.AAA !== 1) fail('themes provider/normalize/orchestrator writer contract failed');
const revision = createRevisionManifest(release);
if (!validateRevisionManifest(revision).ok) fail('release revision contract failed');
const lineage = createLineageRecord({ metricId: 'market.sentiment.fg', evidenceId: evidence.evidenceId, source: 'fixture', sourceKind: 'fixture', observedAt: evidence.observedAt, fetchedAt: evidence.fetchedAt, unit: evidence.unit, state: 'MATCH' });
if (!validateLineageRecord(lineage).ok) fail('lineage contract failed');
const unavailableSnapshot = createMarketSnapshot({ status: 'failed', attemptedAt: '2026-07-18T00:00:00Z', source: 'fixture', coverage: { required: 16, observed: 0 } });
if (!validateMarketSnapshot(unavailableSnapshot).ok) fail('failed market snapshot must remain a valid fail-closed envelope');
const partialPublished = createMarketSnapshot({ status: 'published', attemptedAt: '2026-07-18T00:00:00Z', lastSuccessfulAt: '2026-07-17T00:00:00Z', source: 'fixture', coverage: { required: 16, observed: 15 } });
if (validateMarketSnapshot(partialPublished).ok) fail('partial published market snapshot must be rejected');
if (evaluateClaim({ evidence, claimType: 'numeric', sourceClass: 'INFERRED' }).allowed) fail('inferred numeric claim must be blocked');
const inferred = createInferredClaim({ metricId: 'market.risk', direction: 'mixed', confidence: 'high', sourceUrls: ['https://example.com/a', 'https://example.com/b'], observedWindow: { start: '2026-07-17T00:00:00Z', end: '2026-07-18T00:00:00Z' } });
if (!validateInferredClaim(inferred).ok || !evaluateInferredClaim(inferred).allowed) fail('web-search inference contract failed');
if (validateInferredClaim({ ...inferred, currentValue: 42 }).ok) fail('exact numeric search value must be blocked');
const commandStore = createStore({ initialState: { value: 0 }, reducer: (state, action) => action.type === 'inc' ? { value: state.value + 1 } : state });
commandStore.dispatch({ type: 'inc' });
if (commandStore.getState().value !== 1) fail('state command contract failed');
const httpFixture = createHttpClient({
  fetchImpl: async () => new Response(JSON.stringify({ fixture: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
  clock: { now: () => Date.parse('2026-07-19T00:00:00Z'), iso: () => '2026-07-19T00:00:00Z' }
});
const httpResult = await httpFixture.requestJson('/fixture');
if (!httpResult.ok || httpResult.data?.fixture !== true || !httpResult.fetchedAt) fail('http gateway fixture contract failed');
const storageState = new Map();
const storageFixture = createStorageGateway({ storage: { getItem: (key) => storageState.get(key) ?? null, setItem: (key, value) => storageState.set(key, value), removeItem: (key) => storageState.delete(key) }, prefix: 'fixture' });
storageFixture.set('key', 'value');
if (storageFixture.get('key') !== 'value') fail('storage gateway fixture contract failed');
if (createSanitizer().text('<b>blocked</b>') !== '&lt;b&gt;blocked&lt;/b&gt;') fail('sanitizer fixture contract failed');

// RM-02 performance gate: dispatch+notify must stay fast for a screener-sized (1000-row) slice
// with several subscribers, so W5's real screener/portfolio tables don't reintroduce the
// clone-per-dispatch-per-listener cost RM-02 removed from src/state/store.js. Measured locally:
// the RM-02 design (no clone) is p95=0.111ms for this fixture; the pre-RM-02 clone-per-dispatch
// design was p95=7.49ms — comfortably on either side of a 5ms budget, so 5ms both catches a real
// regression and leaves ~45x headroom for slower CI hardware.
const { createInitialScreenerState: perfInitialScreenerState, screenerReducer: perfScreenerReducer, createScreenerDataAction: perfCreateScreenerDataAction } = await import(pathToFileURL(path.join(root, 'src/state/slices/screener.js')));
const PERF_SCREENER_DISPATCH_P95_BUDGET_MS = 5;
const perfStore = createStore({ initialState: { screener: perfInitialScreenerState() }, reducer: (state, action) => ({ ...state, screener: perfScreenerReducer(state.screener, action) }) });
for (let index = 0; index < 5; index += 1) perfStore.subscribe(() => {});
const perfRows = Array.from({ length: 1000 }, (_, index) => ({ symbol: `SYM${index}`, name: `Company ${index}`, sector: 'Tech', score: index % 100, rank: index + 1 }));
const perfAction = perfCreateScreenerDataAction({ status: 'current', rows: perfRows, revision: 'perf-fixture', updatedAt: '2026-07-19T00:00:00Z' });
const perfSamples = [];
for (let index = 0; index < 200; index += 1) {
  const perfStart = process.hrtime.bigint();
  perfStore.dispatch(perfAction);
  perfSamples.push(Number(process.hrtime.bigint() - perfStart) / 1e6);
}
perfSamples.sort((a, b) => a - b);
const perfP95 = perfSamples[Math.floor(perfSamples.length * 0.95)];
if (perfP95 > PERF_SCREENER_DISPATCH_P95_BUDGET_MS) fail(`RM-02 performance budget exceeded: 1000-row screener dispatch+notify p95=${perfP95.toFixed(3)}ms > ${PERF_SCREENER_DISPATCH_P95_BUDGET_MS}ms`);

console.log(JSON.stringify({ ok: true, routes: golden.routes.length, firstVerticalSlice: golden.firstVerticalSlice, baseline, current, perfScreenerDispatchP95Ms: Number(perfP95.toFixed(3)) }));
