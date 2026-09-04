#!/usr/bin/env node
// P1004: deterministic source-to-screen identity, timeframe and evidence checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const data = read('js/aio-data.js');
const core = read('js/aio-core.js');
const chat = read('js/aio-chat.js');
function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Missing extraction boundary: ${start}`);
  return source.slice(from, to);
}
function node() { return { textContent: '', innerHTML: '', value: '', style: {}, dataset: {}, querySelector: () => node(), querySelectorAll: () => [] }; }
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
vm.runInContext(section(html, 'async function _fetchYahooChartData(ticker,', '// Main comprehensive analysis function'), y.root);
const weekly = await y.root._fetchYahooChartData('NVDA', '2y', '1wk');
check(requestedUrl.includes('interval=1wk') && weekly.interval === '1wk', 'inline Yahoo helper preserves timeframe contract');

// A late technical summary cannot overwrite the newly selected symbol.
const a = deferred(), b = deferred();
const t = context({ _fetchYahooChartData: (symbol) => symbol === 'AAA' ? a.promise : b.promise, initDeepAnalysisSection: async () => {} });
vm.runInContext(section(html, 'async function analyzeTickerDeep(ticker)', '// ═══════════════════════════════════════════════════════════════'), t.root);
const first = t.root.analyzeTickerDeep('AAA');
const second = t.root.analyzeTickerDeep('BBB');
const loadingB = t.nodes.get('ticker-analysis-result').innerHTML;
a.resolve(null); await first;
check(t.nodes.get('ticker-analysis-result').innerHTML === loadingB && t.root._currentTickerId === 'BBB', 'late technical response cannot overwrite current selection');
b.resolve(null); await second;
check(t.nodes.get('ticker-analysis-input').value === 'BBB' && t.nodes.get('deep-sym-input').value === 'BBB', 'both technical inputs share the selected symbol');
check(t.events.some((event) => event.type === 'aio:entityChanged' && event.detail.id === 'BBB'), 'technical selection publishes the canonical document event');

const empty = context({ _currentTickerId: 'AAA', _technicalSelectionEpoch: 1, _daDestroyCharts: () => {}, fetchOHLCVWithFallback: async () => [] });
vm.runInContext(section(html, 'async function initDeepAnalysisSection(symbol,', 'window.runDeepAnalysis ='), empty.root);
await empty.root.initDeepAnalysisSection('AAA', 1);
check(empty.nodes.get('deep-sym-label').textContent.includes('미수신'), 'empty arrays render a completed unavailable state, not an endless loader');

const old = deferred();
const stale = context({ _currentTickerId: 'AAA', _technicalSelectionEpoch: 1, _daDestroyCharts: () => {}, fetchOHLCVWithFallback: () => old.promise });
vm.runInContext(section(html, 'async function initDeepAnalysisSection(symbol,', 'window.runDeepAnalysis ='), stale.root);
const pending = stale.root.initDeepAnalysisSection('AAA', 1);
stale.root._currentTickerId = 'BBB'; stale.root._technicalSelectionEpoch = 2;
stale.nodes.get('deep-sym-label').textContent = 'BBB';
old.resolve([]); await pending;
check(stale.nodes.get('deep-sym-label').textContent === 'BBB', 'late multi-timeframe response is ignored');

const invalid = context({ _currentTickerId: 'NVDA', _currentTickerName: 'NVIDIA', _fundAnalysisData: { ticker: 'NVDA' }, AIO: { state: {} } });
vm.runInContext(section(chat, 'function _resetFundamentalReport(message)', '// ── 기업분석 렌더러'), invalid.root);
invalid.root.document.getElementById('fund-search-input').value = '<invalid>';
await invalid.root.fundamentalSearch();
check(invalid.root._currentTickerId === '' && invalid.root._fundAnalysisData === null, 'invalid fundamental search clears previous identity and report data');
check(invalid.nodes.get('vis-fundamental').style.display === 'none' && invalid.nodes.get('vis-fundamental-radar').textContent === '', 'invalid fundamental search also clears the secondary factor visualization');

const levels = context({ _currentTickerId: 'NVDA', _technicalOHLCV: { NVDA: Array.from({ length: 20 }, (_, i) => ({ time: `2026-08-${String(i + 1).padStart(2, '0')}`, close: 100 + i, high: 101 + i, low: 99 + i })) } });
vm.runInContext(section(html, 'function updateSRLevels() {', '// ── Native 캔들 차트'), levels.root);
levels.root.updateSRLevels();
check(levels.nodes.get('sr-levels-container').dataset.symbol === 'NVDA' && levels.nodes.get('sr-levels-container').innerHTML.includes('119.00'), 'price reference lines use the selected symbol and its observed close');
const ui = read('js/aio-ui.js');
check(!section(ui, 'function _factorRadar(d)', '// ── 4. pipeline-status').includes('|| 50') && ui.includes('Object.assign({}, row.factorScores || {}, { rsi: row.rsi })'), 'factor visualizations preserve zero/missing values and canonical scores');
const themes = read('src/ui/pages/themes.js');
check(themes.includes("catalog.setAttribute('aria-label', '회전 지표 미수신 테마 목록')") && themes.includes('appendUnclassified();'), 'missing RRG observations do not remove the independent theme exploration path');

check(!core.includes('getAdrEstimate(') && !data.includes('function getAdrEstimate('), 'market-cap-derived fake ADR is retired');
check(core.includes('_calcEMA(closes, 20)') && !core.includes('p * 0.99'), 'ticker trend input uses observed OHLCV and the canonical EMA');
check(!html.includes('모멘텀 강세(비중 확대)') && !html.includes('Leading</strong>: 초강세'), 'relative strength labels do not prescribe trades');
check(html.includes('rows.dataQuality && rows.dataQuality.source') && html.includes('if (daily && daily.length >= 20)'), 'deep analysis keeps source labels and does not substitute weekly data into daily levels');
check(chat.includes("var _period = 'CY' + _year + 'Q' + _q;") && !chat.includes("var _period = 'CY' + _year + 'Q' + _q + 'I'"), 'SEC revenue/net-income frames use duration periods, not instant periods');
check(read('src/app/bootstrap.js').includes("legacy.on('aio:entityChanged', syncAnalysis.sync)"), 'native analysis refreshes when entity selection changes');
const suppliedMaterials = read('src/domain/research/supplied-materials.js');
const suppliedBridge = read('src/ui/knowledge/supplied-material-bridge.js');
const chartContract = read('src/domain/chart/contract.js');
const entityNormalizer = read('src/data/normalize/entity.js');
const analysisPage = read('src/ui/pages/analysis.js');
const screenerContract = read('src/data/contracts/screener.js');
const screenerOrchestrator = read('src/data/orchestrators/screener.js');
check(suppliedMaterials.includes('sourceAudit:') && suppliedMaterials.includes('timeSeries:') && suppliedMaterials.includes('routeMappings:'), 'supplied research has centralized audit, time-series and route mappings');
check(['institutional-quarter', 'capital-quarter', 'qualification-milestones', 'physical-ai-operations', 'software-usage-cohort'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), '13F, AI capital, qualification, physical AI and software cohorts are registered');
check(suppliedBridge.includes('aioSuppliedMaterialRoute') && suppliedBridge.includes('시계열 정렬') && suppliedBridge.includes('자료 감사') && suppliedBridge.includes('mediaAudit'), 'route bridge renders source/media audit and time-series alignment without current-value promotion');
check(screenerContract.includes('referenceFrameworkIds') && screenerContract.includes('referenceTimeSeriesIds') && screenerContract.includes('referenceBoundary'), 'screen definition retains research reference metadata');
check(screenerOrchestrator.includes('researchContext') && screenerOrchestrator.includes('SCREENER_RESEARCH_MAPPING'), 'native screener publishes route research context outside ranking inputs');
check(suppliedMaterials.includes("id: 'packet-2026-09-05'") && suppliedMaterials.includes("status: 'DIRECT_READ'") && suppliedMaterials.includes('mediaAudit:'), '2026-09-05 packet records direct-read and media audit status');
check(['event-cluster', 'expectation-vintage', 'ai-capex-flow', 'equipment-cycle', 'treasury-plumbing', 'seasonal-convergence', 'ai-control-plane', 'capacity-cohort', 'owner-fcf-waterfall', 'hypothesis-test', 'reporting-break'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), 'event, expectation, capex, equipment, treasury, seasonality, control-plane, waterfall, hypothesis and reporting time series are registered');
check(['event-cluster-regime', 'oil-shock-policy-branch', 'treasury-front-back-plumbing', 'expectation-credit-cycle', 'ai-capex-flow', 'ai-equipment-cycle', 'ai-control-plane', 'capacity-cohort-waterfall', 'seasonality-convergence', 'hypothesis-event-test', 'reporting-segment-break', 'chart-core-ports', 'supply-bottleneck-graph'].every((id) => suppliedMaterials.includes(`id: '${id}'`)), 'new structural research frameworks are registered');
check(['2095849461423456366', '2095688508597788864', '2095270553406124090', 'github.com/LuxAlgo/Vela', '2095329815767175320', '2094881976927113495', '2095161472204599618', '2095069737545789450', '2094855932027023670', '2094963242414244137', '2094956632472219703', '2094704372831920324', '2094389217782849928', '2094407591006724563', '2093815152193970510', '2093890963865473043'].every((needle) => suppliedMaterials.includes(needle)), 'all newly supplied unique links are present in the central registry');
check(['screener', 'macro', 'fxbond', 'themes', 'ticker', 'fundamental', 'masters', 'technical'].every((route) => suppliedMaterials.includes(`${route}: Object.freeze`)) && suppliedMaterials.includes("'theme-detail': Object.freeze"), 'structural frameworks are mapped to screener and major research routes');
check(chat.includes('supplied-materials-2026-09-05') && chat.includes('AIO_SUPPLIED_MATERIALS_20260905_REFERENCE') && chat.includes('2026-09-05 자료 시계열 정렬'), 'chat context carries the direct-read packet and explicit time-series hard stops');
check(chartContract.includes('canonicalEpochMs') && chartContract.includes('normalizeChartBar') && chartContract.includes('classifyChartUpdate') && chartContract.includes('negotiateChartRenderer'), 'Vela-derived chart boundary exposes canonical bars, update settlement and capability negotiation');
check(entityNormalizer.includes("from '../../domain/chart/contract.js'") && entityNormalizer.includes('epochMs: bar.epochMs') && analysisPage.includes('map(normalizeChartBar)'), 'entity and technical chart inputs cross the canonical time/bar boundary');
const bump = read('scripts/bump-version.mjs');
const recovery = vm.createContext({ resumeFrom: 'v54.67', prevVer: 'v54.67', newVer: 'v54.68' });
vm.runInContext("const targetPattern = (pattern) => new RegExp(pattern.source.replaceAll('v54\\\\.67', 'v54\\\\.68'), pattern.flags);\n" + section(bump, 'function replaceOnce(', 'function replaceAll('), recovery);
check(recovery.replaceOnce('APP_VERSION = v54.68', /APP_VERSION = v54\.67/, 'APP_VERSION = v54.68', 'fixture') === 'APP_VERSION = v54.68', 'version recovery preserves already synchronized surfaces');
check(recovery.replaceOnce('"version":"v54.67"', /("version":")v54\.67(")/, '$1v54.68$2', 'fixture') === '"version":"v54.68"', 'version recovery completes pending captured replacements');
assert.throws(() => recovery.replaceOnce('APP_VERSION = v54.69', /APP_VERSION = v54\.67/, 'APP_VERSION = v54.68', 'fixture'));
check(true, 'version recovery refuses an unrelated version');
console.log(`[research-flow] PASS ${checks} boundary assertions (VM/static; not browser or external certification)`);
