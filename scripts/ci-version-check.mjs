// AIO Screener version synchronization gate.
//
// The project has repeatedly drifted because title, cachebusters, service
// worker version, docs, and changelog were updated independently. This gate
// treats version.json as the canonical version and fails on any mismatch.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripBom = (value) => value.replace(/^\uFEFF/, '');
const read = (path) => stripBom(readFileSync(join(root, path), 'utf8'));
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const failures = [];
function check(label, condition, detail) {
  if (!condition) failures.push(`${label}: ${detail}`);
}

let version;
try {
  version = JSON.parse(read('version.json')).version;
} catch (error) {
  console.error(`version.json read failed: ${error.message}`);
  process.exit(1);
}

if (!/^v\d{1,3}(?:\.\d{2})?$/.test(version)) {
  console.error(`version.json version has a non-canonical format: ${version} (use v54 or v54.01)`);
  process.exit(1);
}

const versionNumber = version.replace(/^v/, '');
const versionRe = escapeRe(version);

const html = read('index.html');
const core = read('js/aio-core.js');
const sw = read('sw.js');
const rootGuide = read('CLAUDE.md');
const contextGuide = read('_context/CLAUDE.md');
const changelog = read('CHANGELOG.md');
// v57.54: dated handoff documents (MARKET-PRINCIPLES-ATLAS-*-2026-08-10.*, SCREENER-...-HANDOFF-2026-08-12.md)
// and the RULES.md frontmatter target_version are frozen history. They are no longer required to carry the
// current version — requiring it made bump-version relabel stale documents as current on every release.
const publicConfig = JSON.parse(read('public-config.json'));
const architectureRevisionFiles = [
  'architecture/asset-manifest.json',
  'architecture/release-manifest.json',
  'architecture/operations-slo.json',
  'architecture/visual-state-matrix.json',
  'architecture/public-readiness.json',
].map((path) => ({ path, data: JSON.parse(read(path)) }));
const operationsStatus = JSON.parse(read('public-data/operations-status.json'));
const bumpScript = read('scripts/bump-version.mjs');

check('index title', html.includes(`<title>AIO Screener ${version} `), `expected ${version}`);
check('index badge', new RegExp(`id="app-version-badge">${versionRe}<`).test(html), `expected ${version}`);
check('APP_VERSION', core.includes(`APP_VERSION = '${version}'`), `expected ${version}`);
check('service worker', sw.includes(`SW_VERSION = '${version}'`), `expected ${version}`);
// Agent guides need not restate the version (CURRENT-STATE.md is canonical). A guide that does carry a
// "현재 버전" line must not lie, so only an existing line is compared.
for (const [label, text, pattern] of [
  ['root CLAUDE.md', rootGuide, /현재 버전:\s*\*\*(v[\d.]+)\*\*/],
  ['_context/CLAUDE.md', contextGuide, /\*\*현재 버전\*\*:\s*(v[\d.]+)/],
]) {
  const stated = text.match(pattern)?.[1];
  check(`v57.54 ${label} 현재 버전 line`, !stated || stated === version, `states ${stated}, expected ${version} (or remove the line)`);
}
check('CHANGELOG.md', new RegExp(`^## ${versionRe}\\b`, 'm').test(changelog), `expected heading for ${version}`);
check('v57.54 bump-version rewrites no _context document other than the guide version line', !/write\(\s*['"`]_context\/(?!CLAUDE\.md['"`])/.test(bumpScript) && !/read\(\s*['"`]_context\/(?:MARKET-PRINCIPLES|SCREENER-OPEN-SOURCE|RULES\.md)/.test(bumpScript), 'dated handoffs and ledger frontmatter are frozen history');
check('bump script canonicalizes one-digit patches', /padStart\(2, '0'\)/.test(bumpScript) && /monotonic|단조 증가/.test(bumpScript), 'bump-version.mjs must normalize v54.1 to v54.01 and reject regressions');

check('public-config appRevision', publicConfig.appRevision === version, `expected ${version}`);
architectureRevisionFiles.forEach(({ path, data }) => {
  check(`${path} appRevision`, data.appRevision === version, `expected ${version}`);
  if (typeof data.workerRevision === 'string') check(`${path} workerRevision`, data.workerRevision === `sw:${version}`, `expected sw:${version}`);
});
// The Worker's /health reports this literal; a stale value makes a live probe unable to
// name the revision it actually served (observed: toml v54.37 while the app ran v55.23).
check('P1155 proxy worker revision', new RegExp(`AIO_APP_REVISION\\s*=\\s*"${versionRe}"`).test(read('worker/wrangler.proxy.toml')), `expected ${version}`);
check('operations status appRevision', operationsStatus.appRevision === version, `expected ${version}`);
check('operations status browser revision', operationsStatus.planes?.browser?.revision === version, `expected ${version}`);
check('CHANGELOG latest release header', new RegExp(`^##\\s+${versionRe}\\b`, 'm').test(changelog), `expected ${version} at the current release boundary`);

const cachebusters = [...html.matchAll(/\?v=([\d.]+)"/g)].map((match) => match[1]);
// Preloads are reusable only when the request URL matches the executed script.
// A bare preload plus a versioned script silently downloads both resources.
for (const name of ['aio-core', 'aio-data', 'aio-ui', 'aio-chat']) {
  const url = `./js/${name}.js?v=${versionNumber}`;
  // v58.80 F01: the legacy scripts are no longer preloaded (they raced the first screen's HTML and stylesheet on slow
  // lines); a preload that does come back must still name the executed URL.
  const preloads = [...html.matchAll(new RegExp(`rel="preload" as="script" href="([^"]*${name}\.js[^"]*)"`, 'g'))].map((match) => match[1]);
  check(`${name} preload parity`, html.includes(`<script src="${url}"`) && preloads.every((href) => href === url), `script and any preload must use ${url}`);
}
const wrongCachebusters = cachebusters.filter((value) => value !== versionNumber);
check(
  'index cachebusters',
  cachebusters.length >= 5 && wrongCachebusters.length === 0,
  `found ${cachebusters.length}, mismatches: ${[...new Set(wrongCachebusters)].join(', ') || 'none'}, expected ${versionNumber}`,
);

if (failures.length) {
  console.error(`Version sync failed. Canonical version: ${version}`);
  failures.forEach((failure) => console.error(` - ${failure}`));
  // P555/R246: this gate has repeatedly failed on commits that could not possibly have
  // caused the drift themselves (e.g. an operator-note.json content edit inherited a break
  // left by an earlier incomplete version bump). Print the direct remediation command so
  // whoever sees this failure — including someone with no context on R1 — can fix it in
  // one step instead of re-deriving which of the 7 locations to touch.
  console.error(`\nFix: run "node scripts/bump-version.mjs ${version}" and commit all resulting changes together, then re-run this check.`);
  process.exit(1);
}

console.log(`Version sync OK: ${version} (${cachebusters.length} cachebusters)`);
