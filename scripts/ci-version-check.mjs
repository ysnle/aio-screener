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

if (!/^v\d{1,3}\.\d{1,2}$/.test(version)) {
  console.error(`version.json version has an invalid format: ${version}`);
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

check('index title', html.includes(`<title>AIO Screener ${version} `), `expected ${version}`);
check('index badge', new RegExp(`id="app-version-badge">${versionRe}<`).test(html), `expected ${version}`);
check('APP_VERSION', core.includes(`APP_VERSION = '${version}'`), `expected ${version}`);
check('service worker', sw.includes(`SW_VERSION = '${version}'`), `expected ${version}`);
check('root CLAUDE.md', rootGuide.includes(version), `expected ${version}`);
check('_context/CLAUDE.md', contextGuide.includes(version), `expected ${version}`);
check('CHANGELOG.md', new RegExp(`^## ${versionRe}\\b`, 'm').test(changelog), `expected heading for ${version}`);

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
  process.exit(1);
}

console.log(`Version sync OK: ${version} (${cachebusters.length} cachebusters)`);
