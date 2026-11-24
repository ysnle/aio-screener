#!/usr/bin/env node
// P1004: deterministic source-to-screen identity, timeframe and evidence checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const data = read('js/aio-data.js');
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
vm.runInContext(section(data, 'async function _aioFetchYahooChartData(', 'var _fetchYahooChartData = window._fetchYahooChartData;'), y.root);
const weekly = await y.root._aioFetchYahooChartData('NVDA', '2y', '1wk');
check(requestedUrl.includes('interval=1wk') && weekly.interval === '1wk', 'inline Yahoo helper preserves timeframe contract');

const invalid = context({ _currentTickerId: 'NVDA', _currentTickerName: 'NVIDIA', _fundAnalysisData: { ticker: 'NVDA' }, AIO: { state: {} } });
// v59.12: the 재무 공시 search moved from src/ui/chat/panel.js to src/ui/components/fundamental-search.js.
const { createFundamentalSearch } = await import('../src/ui/components/fundamental-search.js');
// v59.51: the 재무 search box left; a non-ticker request is never stored, selected or announced (P566/R257).
let invalidDispatches = 0;
invalid.root.document.dispatchEvent = () => { invalidDispatches += 1; };
createFundamentalSearch({ documentRef: invalid.root.document, root: invalid.root })('<invalid>');
check(invalid.root._currentTickerId === 'NVDA' && invalidDispatches === 0, 'v59.51 invalid fundamental search neither selects nor dispatches');

// Supplied research: read the canonical ledger objects, not their source text.
const suppliedReference = (await import(new URL('../src/domain/research/supplied-materials.js', import.meta.url))).SUPPLIED_MATERIALS_REFERENCE;
const nathanThreads = suppliedReference.nathanThreads;
const nathanFrameworkArtifact = JSON.parse(read('public-data/knowledge/nathan-frameworks.json'));
const sourceExtension = suppliedReference.sourceExtensions;
check(sourceExtension?.packetId === 'packet-2026-09-12' && sourceExtension.observations?.length === 5 && sourceExtension.rightsBoundaries?.some((item) => item.id === 'rosy-license-circumvention' && item.status === 'BLOCKED') && sourceExtension.pipeline?.requiredLineage?.includes('watermark'), '2026-09-12 source extension preserves rights boundaries and pipeline lineage');
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
const lazyCorpus = await (await import(new URL('../src/domain/research/corpus-loader.js', import.meta.url))).loadResearchCorpus();
const referenceIndex = await import(new URL('../src/domain/research/reference-index.js', import.meta.url));
check(lazyCorpus.SUPPLIED_MATERIALS_REFERENCE === suppliedReference && JSON.stringify(referenceIndex.SUPPLIED_MATERIAL_CLAIM_IDS) === JSON.stringify(lazyCorpus.SUPPLIED_MATERIAL_CLAIM_IDS) && referenceIndex.SUPPLIED_MATERIALS_META.length === suppliedReference.length, 'the lazy corpus loader resolves the canonical ledger and the boot-time reference index matches it (boot-budget keeps the corpus out of the boot bundle)');
check(nathanThreads?.catalog?.notionBadgeCount === 252 && nathanThreads.catalog.notionPageCount === 249 && nathanThreads.catalog.xLinkCount === 252 && nathanThreads.catalog.directReadCount === 245 && nathanThreads.catalog.xUnverifiedLoadingCount === 0 && nathanThreads.catalog.xNotFoundCount === 7 && nathanThreads.catalog.legacyTwitterLinkCount === 147, 'Nathan Previous Threads inventory preserves the complete Notion X/Twitter access counts and confirmed missing pages');
check(nathanThreads?.contentAudit?.directReadThreadCount === 245 && nathanThreads.contentAudit.visibleThreadPostElements === 1573 && nathanThreads.contentAudit.visibleLinkElements === 9268 && nathanThreads.contentAudit.visibleMediaAndImageElements === 1962 && nathanThreads.contentAudit.visibleActionElements === 8413 && nathanThreads.contentAudit.replyLikeArticleElements === 208, 'Nathan direct-read audit preserves visible post, reply, link, media and action element counts');
check(new Set((nathanThreads?.sourceLinks || [])).size === 252 && (nathanThreads?.threads || []).every((thread) => thread.xUrl.startsWith('https://x.com/NathanYJLee/status/')), 'Nathan Previous Threads exposes 252 canonical X links without non-source URLs');
const nathanDirectIds = new Set((nathanThreads?.threads || []).filter((thread) => thread.directRead).map((thread) => thread.id));
check((nathanThreads?.frameworks || []).length === 28 && (nathanThreads.frameworks || []).every((framework) => framework.sourceRefs?.length && framework.sourceRefs.every((sourceRef) => nathanDirectIds.has(sourceRef)) && framework.invalidation && framework.blockedConsumers?.length), 'Nathan structural frameworks resolve only to directly read sources and retain invalidation/blocked-consumer boundaries');
// v59.88 (ADR-0003 boot slimming): boot readers take the framework ids and the analysis protocol from the leaf
// nathan-framework-ids.js; the 53 KB frameworks load with the AI planner. The leaf must name the same frameworks in order.
const nathanIdLeaf = await import(new URL('../src/domain/research/nathan-framework-ids.js', import.meta.url));
const nathanFrameworkModule = await import(new URL('../src/domain/research/nathan-frameworks.js', import.meta.url));
check(JSON.stringify(nathanIdLeaf.NATHAN_PREVIOUS_THREADS_FRAMEWORK_IDS) === JSON.stringify(nathanFrameworkModule.NATHAN_PREVIOUS_THREADS_FRAMEWORKS.map((framework) => framework.id)), 'v59.88 the boot-time Nathan framework id list equals the frameworks, in order');
check(nathanFrameworkArtifact.schemaVersion === 'nathan-framework-pack.v1' && nathanFrameworkArtifact.articles?.length === 28 && nathanFrameworkArtifact.aliases?.length >= 250, 'Nathan canonical framework artifact preserves 28 structural articles and the broad term dictionary');
check(nathanFrameworkArtifact.articles?.every((article) => article.surface === 'nathan-frameworks' && article.publication === 'EDUCATIONAL_REFERENCE_ONLY' && article.sources?.every((source) => !source.url)), 'Nathan retrieval artifact keeps structured concepts without replaying raw X URLs');
const bump = read('scripts/bump-version.mjs');
const recovery = vm.createContext({ resumeFrom: 'v54.67', prevVer: 'v54.67', newVer: 'v54.68' });
vm.runInContext("const targetPattern = (pattern) => new RegExp(pattern.source.replaceAll('v54\\\\.67', 'v54\\\\.68'), pattern.flags);\n" + section(bump, 'function replaceOnce(', 'function replaceAll('), recovery);
check(recovery.replaceOnce('APP_VERSION = v54.68', /APP_VERSION = v54\.67/, 'APP_VERSION = v54.68', 'fixture') === 'APP_VERSION = v54.68', 'version recovery preserves already synchronized surfaces');
check(recovery.replaceOnce('"version":"v54.67"', /("version":")v54\.67(")/, '$1v54.68$2', 'fixture') === '"version":"v54.68"', 'version recovery completes pending captured replacements');
assert.throws(() => recovery.replaceOnce('APP_VERSION = v54.69', /APP_VERSION = v54\.67/, 'APP_VERSION = v54.68', 'fixture'));
check(true, 'version recovery refuses an unrelated version');
console.log(`[research-flow] PASS ${checks} boundary assertions (VM/static; not browser or external certification)`);
