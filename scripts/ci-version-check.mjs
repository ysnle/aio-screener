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
const auditContract = JSON.parse(read('_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json'));
const handoffManifest = JSON.parse(read('_context/MARKET-PRINCIPLES-ATLAS-HANDOFF-FILE-MANIFEST-2026-08-10.json'));
const structuralHandoff = read('_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md');
const rules = read('_context/RULES.md');
const publicConfig = JSON.parse(read('public-config.json'));
const architectureRevisionFiles = [
  'architecture/asset-manifest.json',
  'architecture/release-manifest.json',
  'architecture/operations-slo.json',
  'architecture/visual-state-matrix.json',
  'architecture/public-readiness.json',
].map((path) => ({ path, data: JSON.parse(read(path)) }));
const operationsStatus = JSON.parse(read('public-data/operations-status.json'));
const screenerHandoff = read('_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md');
const bumpScript = read('scripts/bump-version.mjs');

check('index title', html.includes(`<title>AIO Screener ${version} `), `expected ${version}`);
check('index badge', new RegExp(`id="app-version-badge">${versionRe}<`).test(html), `expected ${version}`);
check('APP_VERSION', core.includes(`APP_VERSION = '${version}'`), `expected ${version}`);
check('service worker', sw.includes(`SW_VERSION = '${version}'`), `expected ${version}`);
check('root CLAUDE.md', rootGuide.includes(version), `expected ${version}`);
check('_context/CLAUDE.md', contextGuide.includes(version), `expected ${version}`);
check('CHANGELOG.md', new RegExp(`^## ${versionRe}\\b`, 'm').test(changelog), `expected heading for ${version}`);
check('active audit contract version', auditContract.targetVersion === version, `expected ${version}`);
check('active handoff manifest version', handoffManifest.applicationVersion === version && String(handoffManifest.packageName || '').endsWith(`-${version}`), `expected ${version}`);
check('active structural handoff version', new RegExp(`^\\s*target_version:\\s*${versionRe}\\s*$`, 'm').test(structuralHandoff) && new RegExp(`^\\s*local_revision:\\s*${versionRe}\\s*$`, 'm').test(structuralHandoff), `expected ${version}`);
check('RULES frontmatter version', new RegExp(`^target_version:\\s*${versionRe}\\s*$`, 'm').test(rules), `expected ${version}`);
check('bump script canonicalizes one-digit patches', /padStart\(2, '0'\)/.test(bumpScript) && /monotonic|단조 증가/.test(bumpScript), 'bump-version.mjs must normalize v54.1 to v54.01 and reject regressions');

check('public-config appRevision', publicConfig.appRevision === version, `expected ${version}`);
architectureRevisionFiles.forEach(({ path, data }) => {
  check(`${path} appRevision`, data.appRevision === version, `expected ${version}`);
  if (typeof data.workerRevision === 'string') check(`${path} workerRevision`, data.workerRevision === `sw:${version}`, `expected sw:${version}`);
});
check('operations status appRevision', operationsStatus.appRevision === version, `expected ${version}`);
check('operations status browser revision', operationsStatus.planes?.browser?.revision === version, `expected ${version}`);
check('screener handoff repository_version', new RegExp(`^repository_version:\\s*${versionRe}\\s*$`, 'm').test(screenerHandoff), `expected ${version}`);
check('CHANGELOG latest release header', new RegExp(`^##\\s+${versionRe}\\b`, 'm').test(changelog), `expected ${version} at the current release boundary`);

const cachebusters = [...html.matchAll(/\?v=([\d.]+)"/g)].map((match) => match[1]);
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
