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
for (const pattern of ['initSentimentPage', 'sentPageCharts', '_refreshSentimentChartData', '_initSentVixChart']) {
  if (aggregate.includes(pattern)) fail(`retired sentiment renderer symbol returned: ${pattern}`);
}
for (const marker of ['createResourceBag', "dataset.aioArchitectureRenderer = 'native'", 'renderSentiment']) {
  if (!sentimentPageSource.includes(marker)) fail(`native sentiment renderer marker missing: ${marker}`);
}
for (const [name, source, markers] of [
  ['guide', guidePageSource, ['createResourceBag', "dataset.aioArchitectureRenderer = 'native'", 'searchGuide']],
  ['news', newsPageSource, ['createResourceBag', "dataset.aioArchitectureRenderer = 'native'", 'renderStories']]
]) {
  for (const marker of markers) if (!source.includes(marker)) fail(`native ${name} renderer marker missing: ${marker}`);
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
const { selectThemesItems } = await import(pathToFileURL(path.join(root, 'src/state/selectors/themes.js')));
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
const themesWriter = createThemesOrchestrator({ provider: createThemesProvider({ read: () => ({ items: [{ id: 'fixture-theme', symbol: 'ETF', pct: 1.2, quadrant: 'leading' }] }) }), commands: themesCommands });
themesWriter.sync();
if (selectThemesItems(themesStore.getState()).length !== 1 || selectThemesItems(themesStore.getState())[0].symbol !== 'ETF') fail('themes provider/normalize/orchestrator writer contract failed');
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

console.log(JSON.stringify({ ok: true, routes: golden.routes.length, firstVerticalSlice: golden.firstVerticalSlice, baseline, current }));
