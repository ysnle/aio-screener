#!/usr/bin/env node
// Release revision and generated release manifests. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('release-revision', [
// ── section release-revision (was ci-release-revision-check.mjs) ──
['release-revision', async () => {
// Local release-revision contract.
// This does not certify live deployment, provider rights, or model efficacy. It
// only proves that the repository's versioned app shell, data artifacts, worker
// source, and Pages allowlist can be described by one deterministic revision.

const { createHash } = await import('node:crypto');
const { existsSync, readFileSync } = await import('node:fs');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = file => join(root, file);
const text = file => readFileSync(path(file), 'utf8');
const json = file => JSON.parse(text(file));
const errors = [];
const check = (label, condition, detail = '') => { if (!condition) errors.push(`${label}${detail ? `: ${detail}` : ''}`); };
const sha256 = value => createHash('sha256').update(value).digest('hex');

const requiredFiles = [
  'version.json', 'index.html', 'sw.js', 'js/aio-core.js', 'js/aio-data.js',
  'js/aio-ui.js', 'src/ui/chat/panel.js', 'js/aio-glossary.js', 'cloudflare-worker-proxy.js',
  'public-data/data.json', 'public-data/screener.json', 'public-artifact-manifest.json', 'public-config.json',
  '.github/workflows/pages-deploy.yml'
];
requiredFiles.forEach(file => check(`${file} exists`, existsSync(path(file))));

if (!errors.length) {
  const version = json('version.json');
  const html = text('index.html');
  const sw = text('sw.js');
  const core = text('js/aio-core.js');
  const worker = text('cloudflare-worker-proxy.js');
  const data = json('public-data/data.json');
  const screener = json('public-data/screener.json');
  const allowlist = json('public-artifact-manifest.json');
  const publicConfig = json('public-config.json');
  const pagesWorkflow = text('.github/workflows/pages-deploy.yml');
  const appVersion = core.match(/const APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const swVersion = sw.match(/const SW_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const swBuild = sw.match(/const SW_BUILD\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const release = {
    schemaVersion: 'local-release-revision-v1',
    appRevision: version.version,
    built: version.built,
    dataRevision: sha256(text('public-data/data.json')),
    screenerRevision: sha256(text('public-data/screener.json')),
    workerRevision: sha256(worker),
    publicArtifactPolicy: sha256(text('public-artifact-manifest.json')),
    liveCertification: 'unverified-by-local-contract'
  };

  check('version.json has canonical monotonic-format version', /^v\d{1,3}(?:\.\d{2})?$/.test(version.version));
  check('APP_VERSION matches version.json', appVersion === version.version, `${appVersion} != ${version.version}`);
  check('SW_VERSION matches version.json', swVersion === version.version, `${swVersion} != ${version.version}`);
  check('SW_BUILD matches version built timestamp', swBuild === version.built, `${swBuild} != ${version.built}`);
  check('HTML title exposes the same version', html.includes(`AIO Screener ${version.version}`));
  check('HTML version badge exposes the same version', html.includes(`id="app-version-badge">${version.version}</span>`));
  check('data artifact has generatedAt', Boolean(data.meta?.generatedAt));
  check('screener artifact has asOf and research-only contract', Boolean(screener.asOf) && screener.rankingContract?.tradingSignal === false && screener.rankingContract?.allowedUse === 'research-relative-ranking-only');
  // public-config.json is release-scoped — only code commits (and bump-version for appRevision) change it. The
  // AI route is the operator's decision: PUBLISHED with no reason, or DISABLED with one. Worker readiness is not copied
  // in; the browser probes /health itself. Both Worker addresses are the ones architecture/worker-endpoints.json names.
  const endpoints = json('architecture/worker-endpoints.json');
  const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
  const proxyUrl = normalizeUrl(endpoints.proxy?.baseUrl);
  const routeDecided = (publicConfig.ai?.routeStatus === 'PUBLISHED' && publicConfig.ai?.routeReason === null)
    || (publicConfig.ai?.routeStatus === 'DISABLED' && typeof publicConfig.ai?.routeReason === 'string' && publicConfig.ai.routeReason.length > 0);
  check('v60.50 public config names the Workers in architecture/worker-endpoints.json', /^https:\/\//.test(proxyUrl)
    && normalizeUrl(publicConfig.ai?.workerUrl) === proxyUrl
    && normalizeUrl(publicConfig.marketData?.workerUrl) === proxyUrl
    && normalizeUrl(publicConfig.marketData?.fastQuotes?.baseUrl) === normalizeUrl(endpoints.fastQuotes?.baseUrl),
  JSON.stringify({ ai: publicConfig.ai?.workerUrl, marketData: publicConfig.marketData?.workerUrl, fast: publicConfig.marketData?.fastQuotes?.baseUrl }));
  check('P1421 public AI config is revision-bound, non-secret, and an explicit operator route decision', publicConfig.schemaVersion === 'ai-public-config.v1'
    && publicConfig.appRevision === version.version
    && routeDecided
    && publicConfig.ai?.serverMode === 'shared-worker-only'
    && publicConfig.ai?.chatPolicy === 'shared-worker-only'
    && publicConfig.ai?.provider === 'openai'
    && publicConfig.ai?.model === 'gpt-6-luna'
    && !/(?:ANTHROPIC|OPENAI)_API_KEY/.test(text('public-config.json')));
  const publicRuntimeScripts = ['js/aio-core.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-glossary.js']; // the AI panel ships inside src/**/*.js
  check('Pages allowlist includes only runtime/data artifacts', Array.isArray(allowlist.publicRootAllowlist)
    && allowlist.publicRootAllowlist.includes('index.html')
    && allowlist.publicRootAllowlist.includes('public-data/*.json')
    && allowlist.publicRootAllowlist.includes('public-config.json')
    && publicRuntimeScripts.every(file => allowlist.publicRootAllowlist.includes(file))
    && !allowlist.publicRootAllowlist.includes('js/*.js')
    && !allowlist.publicRootAllowlist.includes('js/aio-tests.js'));
  check('Pages allowlist excludes the browser test bundle', Array.isArray(allowlist.excludedFromPagesArtifact) && allowlist.excludedFromPagesArtifact.includes('js/aio-tests.js') && !sw.includes('./js/aio-tests.js'));
  // Classic scripts are requested with ?v=<version>, which a query-less precache entry never matches, so every
  // runtime script is cached by the worker's runtime shell rule on first use instead of the install precache.
  const runtimeShellSource = sw.match(/const RUNTIME_SHELL_PATH_RE = \/(.+)\/;/)?.[1];
  const runtimeShellRe = runtimeShellSource ? new RegExp(runtimeShellSource) : null;
  check('v59.98 service worker caches every runtime script by the runtime shell rule and no test bundle',
    publicRuntimeScripts.every(file => Boolean(runtimeShellRe?.test(`/aio/${file}`)))
      && !sw.includes('./js/aio-tests.js'));
  check('Pages staging copies the explicit runtime list', publicRuntimeScripts.every(file => pagesWorkflow.includes(file)) && !pagesWorkflow.includes('rsync -a js/'));
  check('Pages staging copies public AI config', pagesWorkflow.includes('public-config.json'));
  check('v60.21 Pages stages a Korean missing-page recovery link',
    allowlist.publicRootAllowlist.includes('404.html')
      && /\bcp\s+[^\r\n]*\b404\.html\b[^\r\n]*pages-dist/.test(pagesWorkflow)
      && /<html lang="ko">/.test(text('404.html'))
      && /href="\/aio-screener\/#home"/.test(text('404.html')));
  const shareImage = existsSync(path('og-image.png')) ? readFileSync(path('og-image.png')) : Buffer.alloc(0);
  check('v60.21 Open Graph and X use a staged 1200×630 PNG',
    allowlist.publicRootAllowlist.includes('og-image.png')
      && /\bcp\s+[^\r\n]*\bog-image\.png\b[^\r\n]*pages-dist/.test(pagesWorkflow)
      && ['og:image', 'twitter:image'].every((name) => html.includes(`"${name}" content="https://ysnle.github.io/aio-screener/og-image.png"`))
      && shareImage.length >= 24 && shareImage.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
      && shareImage.readUInt32BE(16) === 1200 && shareImage.readUInt32BE(20) === 630);
  check('Pages allowlist excludes Worker source', Array.isArray(allowlist.excludedFromPagesArtifact) && allowlist.excludedFromPagesArtifact.includes('cloudflare-worker-proxy.js'));
  check('Pages artifact excludes canonical bulk ledgers and publishes recursive bounded projections', allowlist.publicRootAllowlist.includes('public-data/**/*.json')
    && ['public-data/sec-fundamentals.json', 'public-data/masters/holdings.json', 'public-data/masters/history-holdings.json', 'public-data/masters/issuer-aggregates.json', 'public-data/masters/managers/**'].every((file) => allowlist.excludedFromPagesArtifact.includes(file))
    && /--exclude 'sec-fundamentals\.json'/.test(pagesWorkflow)
    && /--exclude 'masters\/managers\/'/.test(pagesWorkflow));
  check('release revision has all source hashes', Object.values(release).every(value => value !== null && value !== undefined && value !== ''));
  console.log(JSON.stringify(release, null, 2));
}

if (errors.length) {
  console.error(`Release revision contract failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Release revision contract OK');
}, 'data'],
// ── section release-manifests-code-only (v60.49; replaced generated-release-parity) ──
// The asset/release manifests change only with a code release. Until v60.49 every data refresh rewrote their
// dataRevision, dataGeneratedAt, dataCycleId, dataCycleManifestRevision and generatedAt (3,586 of 5,863 commits), which
// made every long branch conflict with main. The data identity is public-data/operations-status.json dataRevision (built
// from market-snapshot.revision by build-operations-status.mjs); the cycle ids stay in public-data/data.json meta.
['release-manifests-code-only', async () => {
const { readFileSync } = await import('node:fs');
const DATA_FIELDS = ['dataRevision', 'dataGeneratedAt', 'dataCycleId', 'dataCycleManifestRevision', 'generatedAt'];
for (const file of ['architecture/asset-manifest.json', 'architecture/release-manifest.json']) {
  const carried = DATA_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(JSON.parse(readFileSync(file, 'utf8')), field));
  if (carried.length) throw new Error(`[release-manifests-code-only] ${file} carries data-owned field(s) ${carried.join(', ')}; the data revision lives in public-data/operations-status.json`);
}
console.log('[release-manifests-code-only] OK: asset/release manifests carry no data revision fields');
}, 'code'],
// ── section release-rollback-invariants (kept from the retired ci-release-manifest-contract.mjs) ──
['release-rollback-invariants', async () => {
const { readFileSync } = await import('node:fs');
const manifest = JSON.parse(readFileSync('architecture/asset-manifest.json', 'utf8'));
if (!manifest.rollback?.appDataIndependent || !manifest.rollback?.workerCacheIndependent) throw new Error('[release-rollback-invariants] rollback independence missing (asset-manifest rollback.appDataIndependent / workerCacheIndependent)');
if (!Array.isArray(manifest.immutableRuntime) || !manifest.immutableRuntime.includes('src/**/*.js')) throw new Error('[release-rollback-invariants] native runtime allowlist missing (asset-manifest immutableRuntime must include src/**/*.js)');
console.log(`[release-rollback-invariants] OK: rollback ${manifest.rollback.strategy}, immutableRuntime ${manifest.immutableRuntime.length} pattern(s)`);
}, 'code'],
]);
