// Local release-revision contract.
// This does not certify live deployment, provider rights, or model efficacy. It
// only proves that the repository's versioned app shell, data artifacts, worker
// source, and Pages allowlist can be described by one deterministic revision.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = file => join(root, file);
const text = file => readFileSync(path(file), 'utf8');
const json = file => JSON.parse(text(file));
const errors = [];
const check = (label, condition, detail = '') => { if (!condition) errors.push(`${label}${detail ? `: ${detail}` : ''}`); };
const sha256 = value => createHash('sha256').update(value).digest('hex');

const requiredFiles = [
  'version.json', 'index.html', 'sw.js', 'js/aio-core.js', 'js/aio-data.js',
  'js/aio-ui.js', 'js/aio-chat.js', 'js/aio-glossary.js', 'cloudflare-worker-proxy.js',
  'public-data/data.json', 'public-data/screener.json', 'public-artifact-manifest.json', 'public-config.json',
  '.github/workflows/ci.yml'
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
  const ciWorkflow = text('.github/workflows/ci.yml');
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
  check('public AI config is revision-bound, non-secret, and explicit', publicConfig.schemaVersion === 'ai-public-config.v1'
    && publicConfig.appRevision === version.version
    && publicConfig.ai?.serverMode === 'explicit-opt-in'
    && publicConfig.ai?.workerUrl === null);
  const publicRuntimeScripts = ['js/aio-core.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-chat.js', 'js/aio-glossary.js'];
  check('Pages allowlist includes only runtime/data artifacts', Array.isArray(allowlist.publicRootAllowlist)
    && allowlist.publicRootAllowlist.includes('index.html')
    && allowlist.publicRootAllowlist.includes('public-data/*.json')
    && allowlist.publicRootAllowlist.includes('public-config.json')
    && publicRuntimeScripts.every(file => allowlist.publicRootAllowlist.includes(file))
    && !allowlist.publicRootAllowlist.includes('js/*.js')
    && !allowlist.publicRootAllowlist.includes('js/aio-tests.js'));
  check('Pages allowlist excludes the browser test bundle', Array.isArray(allowlist.excludedFromPagesArtifact) && allowlist.excludedFromPagesArtifact.includes('js/aio-tests.js') && !sw.includes('./js/aio-tests.js'));
  check('service worker caches every runtime script and no test bundle', publicRuntimeScripts.every(file => sw.includes(`./${file}`)) && !sw.includes('./js/aio-tests.js'));
  check('Pages staging copies the explicit runtime list', publicRuntimeScripts.every(file => ciWorkflow.includes(file)) && !ciWorkflow.includes('rsync -a js/'));
  check('Pages staging copies public AI config', ciWorkflow.includes('public-config.json'));
  check('Pages allowlist excludes Worker source', Array.isArray(allowlist.excludedFromPagesArtifact) && allowlist.excludedFromPagesArtifact.includes('cloudflare-worker-proxy.js'));
  check('release revision has all source hashes', Object.values(release).every(value => value !== null && value !== undefined && value !== ''));
  console.log(JSON.stringify(release, null, 2));
}

if (errors.length) {
  console.error(`Release revision contract failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Release revision contract OK');
