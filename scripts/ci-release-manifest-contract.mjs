import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('architecture/asset-manifest.json'));
const version = JSON.parse(read('version.json'));
const release = JSON.parse(read('architecture/release-manifest.json'));
const snapshot = JSON.parse(read('public-data/market-snapshot.json'));
const sw = read('sw.js');
const fail = (message) => { throw new Error(`[release-manifest] ${message}`); };
if (manifest.appRevision !== version.version || release.appRevision !== version.version) fail('app revision mismatch');
if (manifest.dataRevision !== snapshot.revision || release.dataRevision !== snapshot.revision) fail('release data revision does not match the published market snapshot');
if (!manifest.rollback.appDataIndependent || !manifest.rollback.workerCacheIndependent) fail('rollback independence missing');
if (!sw.includes(`const SW_VERSION = '${version.version}'`)) fail('worker revision mismatch');
if (!Array.isArray(manifest.immutableRuntime) || !manifest.immutableRuntime.includes('src/**/*.js')) fail('native runtime allowlist missing');
console.log(JSON.stringify({ ok: true, appRevision: manifest.appRevision, dataRevision: manifest.dataRevision, evidenceRevision: manifest.evidenceRevision, workerRevision: manifest.workerRevision, rollback: manifest.rollback.strategy }));
