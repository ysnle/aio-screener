#!/usr/bin/env node
// P1004: deterministic source-to-screen identity, timeframe and evidence checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const data = read('js/aio-data.js');
const core = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
const chat = read('js/aio-chat.js');
// P1132/R619: the inline Yahoo chart helper moved from index.html's block F into js/aio-ui.js.
const ui = read('js/aio-ui.js');
// P1135/R620 → legacy unification: js/aio-macro-tech.js (block B) is retired; the price reference-line pin scans the
// remaining legacy shell files instead.
const macroTech = ['js/aio-pages.js', 'js/aio-ui.js', 'js/aio-core.js'].map(read).join('\n');
function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Missing extraction boundary: ${start}`);
  return source.slice(from, to);
}
function node() { return { textContent: '', innerHTML: '', value: '', style: {}, dataset: {}, classList: { contains: () => false }, querySelector: () => node(), querySelectorAll: () => [] }; }
function context(extra = {}) {
  const nodes = new Map();
  const events = [];
  const root = {
    document: { getElementById: (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, dispatchEvent: (event) => events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    escHtml: (s) => String(s), _aioLog: () => {}, showToast: () => {},
    ...extra
  };
  root.window = root;
  return { root: vm.createContext(root), nodes, events };
}
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; console.log(`PASS ${message}`); };

// The fallback must request true weekly/monthly bars, not rename daily bars.
const calls = [];
const f = context({
  fetchOHLCV: async () => [],
  _normalizeOHLCVRows: (rows, bars) => rows.slice(-bars),
  _attachOHLCVQuality: (rows, quality) => Object.assign(rows, { dataQuality: quality }),
  _fetchYahooChartData: async (...args) => { calls.push(args); return { closes: [100], opens: [99], highs: [101], lows: [98], volumes: [1000], timestamps: [1787918400] }; }
});
vm.runInContext(section(data, 'function _yahooRangeForOHLCV(', 'window.fetchOHLCVWithFallback ='), f.root);
for (const interval of ['1month', '1week', '1day']) {
  const rows = await f.root.fetchOHLCVWithFallback('NVDA', interval, 60);
  check(rows.dataQuality.interval === interval && rows[0].time, `OHLCV ${interval}: observation date and requested interval survive fallback`);
}
check(calls.map((args) => args[2]).join(',') === '1mo,1wk,1d', 'OHLCV Yahoo interval mapping is exact');

let requestedUrl = '';
const y = context({ T: { FETCH_TIMEOUT: 100 }, fetchViaProxy: async (url) => { requestedUrl = url; return { chart: { result: [{ meta: { symbol: 'NVDA', dataGranularity: '1wk' }, timestamp: [1787918400], indicators: { quote: [{ close: [100] }] } }] } }; } });
vm.runInContext(section(data, 'async function _aioFetchYahooChartData(', '// 모듈 스코프'), y.root);
// P1132/R619: the inline 3-line delegation wrapper that used to sit in index.html's block F has been
// deleted — it was always shadowed by aio-data.js's `window._fetchYahooChartData = _aioFetchYahooChartData`
// assignment and only became the winner (with new default arguments) when the block moved. The
// canonical producer sliced above is now the only transport, so drive it directly.
const weekly = await y.root._aioFetchYahooChartData('NVDA', '2y', '1wk');
check(requestedUrl.includes('interval=1wk') && weekly.interval === '1wk', 'inline Yahoo helper preserves timeframe contract');

// P1753: the legacy US deep-analysis fold (analyzeTickerDeep/initDeepAnalysisSection/runDeepAnalysis) lost its
// #ticker-analysis-result sink in v56.96 and returned early ever since; it was retired. The technical bridge
// now only names the subject and opens the native 차트 route, so the late-response races above it are gone.
check(!/async function (?:analyzeTickerDeep|initDeepAnalysisSection)\(/.test(ui) && !ui.includes('window.runDeepAnalysis ='), 'P1753 retired legacy deep-analysis runner stays gone');
check(/function _aioOpenTechnicalAnalysis\(ticker\)[\s\S]{0,700}window\._aioChartRequest = sym;[\s\S]{0,120}showPage\('technical'\)/.test(core), 'P1753 technical bridge opens the native chart route for the selected subject');

const invalid = context({ _currentTickerId: 'NVDA', _currentTickerName: 'NVIDIA', _fundAnalysisData: { ticker: 'NVDA' }, AIO: { state: {} } });
vm.runInContext(section(chat, 'function _resetFundamentalReport(message)', '// ── 기업분석 렌더러'), invalid.root);
invalid.root.document.getElementById('fund-search-input').value = '<invalid>';
await invalid.root.fundamentalSearch();
check(invalid.root._currentTickerId === '' && invalid.root._fundAnalysisData === null, 'invalid fundamental search clears previous identity and report data');
check(invalid.nodes.get('vis-fundamental').style.display === 'none' && invalid.nodes.get('vis-fundamental-radar').textContent === '', 'invalid fundamental search also clears the secondary factor visualization');

// P1672: #sr-levels-container left the technical page; the stock-chart component draws price levels now.
check(!macroTech.includes('function updateSRLevels'), 'retired legacy price reference-line writer stays retired');
check(!section(ui, 'function _factorRadar(d)', '// ── 4. pipeline-status').includes('|| 50') && ui.includes('Object.assign({}, row.factorScores || {}, { rsi: row.rsi })'), 'factor visualizations preserve zero/missing values and canonical scores');
const themes = read('src/ui/pages/themes.js');
check(themes.includes("catalog.setAttribute('aria-label', '회전 지표 미수신 테마 목록')") && themes.includes('appendUnclassified();'), 'missing RRG observations do not remove the independent theme exploration path');

check(!core.includes('getAdrEstimate(') && !data.includes('function getAdrEstimate('), 'market-cap-derived fake ADR is retired');
check(!core.includes('window._aioFillEntryFromTicker =') && !core.includes('p * 0.99'), 'P1430: the manual entry calculator (synthetic-EMA risk) stays retired');
// P1132/R619: the relative-strength and deep-analysis renderers moved to js/aio-ui.js. Repointing these
// matters for the absence check too — pinned to index.html it would now pass vacuously.
check(!ui.includes('모멘텀 강세(비중 확대)') && !ui.includes('Leading</strong>: 초강세'), 'relative strength labels do not prescribe trades');
check(!ui.includes('function _daKeyLevels(') && !ui.includes('function _daDestroyCharts('), 'P1753 retired deep-analysis multi-timeframe level panel stays gone');
check(chat.includes("var _period = 'CY' + _year + 'Q' + _q;") && !chat.includes("var _period = 'CY' + _year + 'Q' + _q + 'I'"), 'SEC revenue/net-income frames use duration periods, not instant periods');
check(read('src/app/bootstrap.js').includes("legacy.on('aio:entityChanged', syncAnalysis.sync)"), 'native analysis refreshes when entity selection changes');
const suppliedMaterials = read('src/domain/research/supplied-materials.js');
const suppliedBridge = read('src/ui/knowledge/supplied-material-bridge.js');
const chartContract = read('src/domain/chart/contract.js');
const entityNormalizer = read('src/data/normalize/entity.js');
const analysisPage = read('src/ui/pages/analysis.js');
const screenerContract = read('src/data/contracts/screener.js');
const screenerOrchestrator = read('src/data/orchestrators/screener.js');
const knowledgeRetriever = read('src/ai/retrieval/knowledge.js');
const bootstrap = read('src/app/bootstrap.js');
const nathanThreadsSource = read('src/domain/research/nathan-previous-threads.js');
const nathanFrameworkPackSource = read('src/domain/knowledge/nathan-framework-pack.js');
const nathanFrameworkArtifact = JSON.parse(read('public-data/knowledge/nathan-frameworks.json'));
const questionPlanner = read('src/ai/orchestrator/question-planner.js');
const researchPlan = read('src/ai/research/plan.js');
const suppliedReference = (await import(new URL('../src/domain/research/supplied-materials.js', import.meta.url))).SUPPLIED_MATERIALS_REFERENCE;
const nathanThreads = suppliedReference.nathanThreads;
check(suppliedMaterials.includes('sourceAudit:') && suppliedMaterials.includes('timeSeries:') && suppliedMaterials.includes('routeMappings:'), 'supplied research has centralized audit, time-series and route mappings');
check(['institutional-quarter', 'capital-quarter', 'qualification-milestones', 'physical-ai-operations', 'software-usage-cohort'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), '13F, AI capital, qualification, physical AI and software cohorts are registered');
check(suppliedBridge.includes('aioSuppliedMaterialRoute') && suppliedBridge.includes('referenceTimeSeriesCount') && suppliedBridge.includes('processingBoundary') && !suppliedBridge.includes('renderSourceTimeline') && !suppliedBridge.includes('renderMediaAudit'), 'route bridge exposes supplied-material scope as hidden protocol metadata instead of rendering a source/media panel');
check(screenerContract.includes('referenceFrameworkIds') && screenerContract.includes('referenceTimeSeriesIds') && screenerContract.includes('referenceClaimIds') && screenerContract.includes('referenceBoundary'), 'screen definition retains framework, time-series and claim research metadata');
check(screenerOrchestrator.includes('researchContext') && screenerOrchestrator.includes('SCREENER_RESEARCH_MAPPING'), 'native screener publishes route research context outside ranking inputs');
check(suppliedMaterials.includes("id: 'packet-2026-09-05'") && suppliedMaterials.includes("status: 'DIRECT_READ'") && suppliedMaterials.includes('mediaAudit:'), '2026-09-05 packet records direct-read and media audit status');
check(suppliedMaterials.includes("id: 'packet-2026-09-11'") && suppliedMaterials.includes('sourceObservations:') && suppliedMaterials.includes('attachment-dell-post-earnings-breakout-20260911'), '2026-09-11 packet records direct-read timeline and attached DELL chart audit');
const sourceExtension = suppliedReference.sourceExtensions;
check(sourceExtension?.packetId === 'packet-2026-09-12' && sourceExtension.observations?.length === 5 && sourceExtension.rightsBoundaries?.some((item) => item.id === 'rosy-license-circumvention' && item.status === 'BLOCKED') && sourceExtension.pipeline?.requiredLineage?.includes('watermark'), '2026-09-12 source extension preserves rights boundaries and pipeline lineage');
check(['2096202208811384911', '2091275293981884547', '2095899328661410038', 'github.com/KoNananachan/Neuberg', 'github.com/LuxAlgo/edge-stats', 'edge-stats/blob/main/ARCHITECTURE.md', 'edge-stats/blob/main/docs/data-sources.md'].every((needle) => suppliedMaterials.includes(needle)), '2026-09-12 X/GitHub source roots and pipeline documentation are present');
check(['conditional-evidence-envelope', 'market-data-lineage-pipeline', 'chart-evidence-drilldown', 'terminal-panel-capability-registry', 'agent-research-execution-boundary'].every((id) => suppliedMaterials.includes(`id: '${id}'`)) && ['session-conditional-evidence', 'data-lineage-watermark', 'agent-research-audit'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), '2026-09-12 conditional evidence, lineage, chart, terminal and agent boundaries are registered');
check(['exposure-leverage', 'structure-confirmation', 'behavior-horizon', 'investment-financing-productivity', 'dollar-rails'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), 'leverage, structure, behavior, productivity and dollar-rail time series are registered');
check(['leverage-exposure-discipline', 'wedge-pop-retest', 'proof-before-exposure', 'investor-behavior-loop', 'investment-financing-productivity', 'dollar-rails-amplifier'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), '2026-09-11 supplied frameworks are registered with invalidation boundaries');
check(['2097957777922793710', '2097868442309472608', '2097722372757295582', '2097557593573199994', '2096959904410193928', '2096762435315384622', '2096672934828093812', '2095358094956245419'].every((needle) => suppliedMaterials.includes(needle)), 'all eight 2026-09-11 X sources are present in the central registry');
const claimLedger = suppliedReference.claimLedger;
const claims = claimLedger?.claims || [];
const claimRequiredFields = claimLedger?.requiredFields || [];
check(claimLedger?.schemaVersion === 'supplied-material-claims.v1' && claims.filter((claim) => claim.id.startsWith('claim-20260911-')).length === 9, '2026-09-11 packet has one claim-level row for each X source and attached DELL chart');
check(claims.every((claim) => claimRequiredFields.every((field) => claim[field] !== undefined && claim[field] !== null && (Array.isArray(claim[field]) ? claim[field].length > 0 : String(claim[field]).trim().length > 0))), 'every claim row carries Q1-Q5, chart, inputs, timeframe, confirmation, invalidation, counterclaim and consumer boundaries');
check(claims.every((claim) => claim.sourceRefs?.length && String(claim.currentnessBoundary || '').toUpperCase().includes('REFERENCE') && claim.blockedConsumers?.length), 'every claim retains source attribution, currentness boundary and blocked consumer list');
const knownMaterialIds = new Set([...(suppliedReference.sourceObservations || []), ...(suppliedReference.mediaAudit || [])].map((item) => item.id));
check(claims.every((claim) => claim.sourceRefs.every((sourceRef) => knownMaterialIds.has(sourceRef))), 'every claim source reference resolves to a directly audited observation or media row');
check((suppliedReference.sourceObservations || []).every((observation) => claims.some((claim) => claim.sourceRefs.includes(observation.id))), 'all eight directly read X observations have a claim-level consumer row');
check(claims.some((claim) => claim.id === 'claim-20260911-dell-post-earnings-breakout' && claim.sourceRefs.includes('attachment-dell-post-earnings-breakout-20260911')) && claims.some((claim) => claim.id === 'claim-20260911-wyckoff-box-retest' && claim.quotedSourceRefs?.includes('quoted-post-20260902')), 'attached media and quoted-post time elements remain explicit in the claim ledger');
check(suppliedMaterials.includes('SUPPLIED_MATERIAL_CLAIM_IDS') && suppliedMaterials.includes('getSuppliedMaterialClaims'), 'claim ledger exposes a canonical ID list and filtered read API');
check(!suppliedBridge.includes('aio-reference-bridge-claim-card') && suppliedBridge.includes('internal-protocol-only') && suppliedMaterials.includes('getSuppliedMaterialClaims') && suppliedMaterials.includes('SUPPLIED_MATERIAL_CLAIM_IDS'), 'claim ledger stays reachable through the internal claim API instead of being rendered into a user-facing panel');
check(knowledgeRetriever.includes('suppliedMaterialArticles') && knowledgeRetriever.includes('suppliedMaterials'), 'AI knowledge retrieval indexes canonical supplied-material claims as reference articles');
check(bootstrap.includes('suppliedMaterials: loadSuppliedMaterials') && bootstrap.includes('SUPPLIED_MATERIAL_CLAIM_IDS') && bootstrap.includes('ensureResearchCorpus') && bootstrap.includes('beforeDispatch'), 'bootstrap connects the canonical claim ledger to chat/knowledge runtime consumers (lazy corpus, installed before a chat prompt is built)');
check(!/from '\.\.\/domain\/research\/supplied-materials\.js'/.test(bootstrap) && read('src/domain/research/corpus-loader.js').includes("import('./supplied-materials.js')"), 'the supplied-materials corpus loads through corpus-loader.js, never as a static boot import');
check(nathanThreadsSource.includes('RAW_THREADS') && nathanThreadsSource.includes('DIRECT_READ_DERIVED') && nathanThreadsSource.includes('X_UNVERIFIED_LOADING'), 'Nathan Previous Threads keeps a link catalog, direct-read boundary and blocked status in a dedicated reference registry');
check(nathanThreads?.catalog?.notionBadgeCount === 252 && nathanThreads.catalog.notionPageCount === 249 && nathanThreads.catalog.xLinkCount === 252 && nathanThreads.catalog.directReadCount === 245 && nathanThreads.catalog.xUnverifiedLoadingCount === 0 && nathanThreads.catalog.xNotFoundCount === 7 && nathanThreads.catalog.legacyTwitterLinkCount === 147, 'Nathan Previous Threads inventory preserves the complete Notion X/Twitter access counts and confirmed missing pages');
check(nathanThreads?.contentAudit?.directReadThreadCount === 245 && nathanThreads.contentAudit.visibleThreadPostElements === 1573 && nathanThreads.contentAudit.visibleLinkElements === 9268 && nathanThreads.contentAudit.visibleMediaAndImageElements === 1962 && nathanThreads.contentAudit.visibleActionElements === 8413 && nathanThreads.contentAudit.replyLikeArticleElements === 208, 'Nathan direct-read audit preserves visible post, reply, link, media and action element counts');
check(new Set((nathanThreads?.sourceLinks || [])).size === 252 && (nathanThreads?.threads || []).every((thread) => thread.xUrl.startsWith('https://x.com/NathanYJLee/status/')), 'Nathan Previous Threads exposes 252 canonical X links without non-source URLs');
const nathanDirectIds = new Set((nathanThreads?.threads || []).filter((thread) => thread.directRead).map((thread) => thread.id));
check((nathanThreads?.frameworks || []).length === 28 && (nathanThreads.frameworks || []).every((framework) => framework.sourceRefs?.length && framework.sourceRefs.every((sourceRef) => nathanDirectIds.has(sourceRef)) && framework.invalidation && framework.blockedConsumers?.length), 'Nathan structural frameworks resolve only to directly read sources and retain invalidation/blocked-consumer boundaries');
check(knowledgeRetriever.includes('nathan-frameworks') && knowledgeRetriever.includes('nathanThreads?.frameworks') && bootstrap.includes('NATHAN_PREVIOUS_THREADS_REFERENCE'), 'Nathan structural frameworks are connected to AI retrieval and the canonical runtime facade');
check(screenerOrchestrator.includes('SCREENER_REFERENCE_FRAMEWORK_IDS') && screenerOrchestrator.includes('nathanFrameworkIds'), 'Nathan structural frameworks are attached to screener reference metadata outside ranking inputs');
check(nathanFrameworkPackSource.includes('NATHAN_KNOWLEDGE_CONCEPTS') && nathanFrameworkPackSource.includes('NATHAN_KNOWLEDGE_ALIASES') && nathanFrameworkPackSource.includes('NATHAN_ANALYSIS_PROTOCOL'), 'Nathan material has a canonical concept, dictionary and analysis-protocol projection');
check(nathanFrameworkArtifact.schemaVersion === 'nathan-framework-pack.v1' && nathanFrameworkArtifact.articles?.length === 28 && nathanFrameworkArtifact.aliases?.length >= 250, 'Nathan canonical framework artifact preserves 28 structural articles and the broad term dictionary');
check(nathanFrameworkArtifact.articles?.every((article) => article.surface === 'nathan-frameworks' && article.publication === 'EDUCATIONAL_REFERENCE_ONLY' && article.sources?.every((source) => !source.url)), 'Nathan retrieval artifact keeps structured concepts without replaying raw X URLs');
check(suppliedBridge.includes('integrationMode') && suppliedBridge.includes('internal-protocol-only') && suppliedBridge.includes('section.hidden = true'), 'operational routes consume supplied material through hidden protocol metadata rather than a visible source panel');
check(questionPlanner.includes('buildNathanAnalysisContext') && questionPlanner.includes('referenceContext') && researchPlan.includes('referenceContext'), 'reference protocol is attached during question and research planning');
check(['event-cluster', 'expectation-vintage', 'ai-capex-flow', 'equipment-cycle', 'treasury-plumbing', 'seasonal-convergence', 'ai-control-plane', 'capacity-cohort', 'owner-fcf-waterfall', 'hypothesis-test', 'reporting-break'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), 'event, expectation, capex, equipment, treasury, seasonality, control-plane, waterfall, hypothesis and reporting time series are registered');
check(['event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'expectation-credit-cycle', 'ai-capex-flow', 'ai-equipment-cycle', 'ai-control-plane', 'capacity-cohort-waterfall', 'seasonality-convergence', 'hypothesis-event-test', 'reporting-segment-break', 'chart-core-ports', 'supply-bottleneck-graph'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), 'new structural research frameworks are registered');
check(['2095849461423456366', '2095688508597788864', '2095270553406124090', 'github.com/LuxAlgo/Vela', '2095329815767175320', '2094881976927113495', '2095161472204599618', '2095069737545789450', '2094855932027023670', '2094963242414244137', '2094956632472219703', '2094704372831920324', '2094389217782849928', '2094407591006724563', '2093815152193970510', '2093890963865473043'].every((needle) => suppliedMaterials.includes(needle)), 'all newly supplied unique links are present in the central registry');
check(['screener', 'macro', 'fxbond', 'themes', 'ticker', 'fundamental', 'masters', 'technical'].every((route) => suppliedMaterials.includes(`${route}: Object.freeze`)) && suppliedMaterials.includes("'theme-detail': Object.freeze"), 'structural frameworks are mapped to screener and major research routes');
check(chat.includes('supplied-materials-2026-09-05') && chat.includes('AIO_SUPPLIED_MATERIALS_20260905_REFERENCE') && chat.includes('2026-09-05 자료 시계열 정렬'), 'chat context carries the direct-read packet and explicit time-series hard stops');
check(chartContract.includes('canonicalEpochMs') && chartContract.includes('normalizeChartBar') && chartContract.includes('classifyChartUpdate') && chartContract.includes('negotiateChartRenderer'), 'Vela-derived chart boundary exposes canonical bars, update settlement and capability negotiation');
check(entityNormalizer.includes("from '../../domain/chart/contract.js'") && entityNormalizer.includes('epochMs: bar.epochMs'), 'entity and technical chart inputs cross the canonical time/bar boundary');
const bump = read('scripts/bump-version.mjs');
const recovery = vm.createContext({ resumeFrom: 'v54.67', prevVer: 'v54.67', newVer: 'v54.68' });
vm.runInContext("const targetPattern = (pattern) => new RegExp(pattern.source.replaceAll('v54\\\\.67', 'v54\\\\.68'), pattern.flags);\n" + section(bump, 'function replaceOnce(', 'function replaceAll('), recovery);
check(recovery.replaceOnce('APP_VERSION = v54.68', /APP_VERSION = v54\.67/, 'APP_VERSION = v54.68', 'fixture') === 'APP_VERSION = v54.68', 'version recovery preserves already synchronized surfaces');
check(recovery.replaceOnce('"version":"v54.67"', /("version":")v54\.67(")/, '$1v54.68$2', 'fixture') === '"version":"v54.68"', 'version recovery completes pending captured replacements');
assert.throws(() => recovery.replaceOnce('APP_VERSION = v54.69', /APP_VERSION = v54\.67/, 'APP_VERSION = v54.68', 'fixture'));
check(true, 'version recovery refuses an unrelated version');
console.log(`[research-flow] PASS ${checks} boundary assertions (VM/static; not browser or external certification)`);
