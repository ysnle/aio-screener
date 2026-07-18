import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[architecture-contract] ${message}`); };

const golden = JSON.parse(read('architecture/golden-routes.json'));
const release = JSON.parse(read('architecture/release-manifest.json'));
const publicManifest = JSON.parse(read('public-artifact-manifest.json'));
const serviceWorkerSource = read('sw.js');
if (!Array.isArray(golden.routes) || golden.routes.length !== 17) fail('golden route count must be 17');
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

const modules = await Promise.all([
  import(pathToFileURL(path.join(root, 'src/data/contracts/evidence.js'))),
  import(pathToFileURL(path.join(root, 'src/data/evidence-store.js'))),
  import(pathToFileURL(path.join(root, 'src/domain/sentiment/metrics.js'))),
  import(pathToFileURL(path.join(root, 'src/state/store.js'))),
  import(pathToFileURL(path.join(root, 'src/data/contracts/revision.js'))),
  import(pathToFileURL(path.join(root, 'src/data/quality/lineage.js'))),
  import(pathToFileURL(path.join(root, 'src/data/contracts/market-snapshot.js'))),
  import(pathToFileURL(path.join(root, 'src/ai/policy.js'))),
  import(pathToFileURL(path.join(root, 'src/ai/inference.js')))
]);
const [{ createEvidence, validateEvidence }, { createEvidenceStore }, { deriveSentimentSummary }, { createStore }, { createRevisionManifest, validateRevisionManifest }, { createLineageRecord, validateLineageRecord }, { createMarketSnapshot, validateMarketSnapshot }, { evaluateClaim }, { createInferredClaim, validateInferredClaim, evaluateInferredClaim }] = modules;
const evidence = createEvidence({ metric: 'fearGreed', value: 42, unit: 'score', sourceKind: 'fixture', observedAt: '2026-07-18T00:00:00Z', fetchedAt: '2026-07-18T00:00:01Z', status: 'live' });
if (!validateEvidence(evidence).ok || evidence.allowedUse !== 'decision') fail('live evidence contract failed');
const store = createEvidenceStore();
store.ingest(evidence);
if (store.get('fearGreed')?.evidenceId !== evidence.evidenceId) fail('evidence store read-back failed');
const summary = deriveSentimentSummary({ fearGreed: 42, vix9d: 18, vix: 17, vix3m: 20, vix6m: 22 });
if (summary.blocked || summary.vixTermStructure.regime !== '콘탱고') fail('sentiment domain contract failed');
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

console.log(JSON.stringify({ ok: true, routes: golden.routes.length, firstVerticalSlice: golden.firstVerticalSlice, baseline, current }));
