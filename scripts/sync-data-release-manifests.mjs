import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await readFile(resolve(root, relative), 'utf8'));
const writeJson = async (relative, value) => writeFile(resolve(root, relative), `${JSON.stringify(value, null, 2)}\n`);

const snapshot = await readJson('public-data/market-snapshot.json');
const data = await readJson('public-data/data.json');
if (snapshot.status !== 'published' || !snapshot.revision) throw new Error('DATA_RELEASE_MANIFEST_BLOCKED:market_snapshot_not_published');

const updates = {
  dataRevision: snapshot.revision,
  dataGeneratedAt: snapshot.generatedAt || snapshot.attemptedAt || null,
  dataCycleId: data.meta?.cycleId || null,
  dataCycleManifestRevision: data.meta?.cycleManifestRevision || null
};
const now = new Date().toISOString();
let changedAny = false;
for (const relative of ['architecture/asset-manifest.json', 'architecture/release-manifest.json']) {
  const manifest = await readJson(relative);
  const changed = manifest.dataRevision !== updates.dataRevision
    || manifest.dataGeneratedAt !== updates.dataGeneratedAt
    || manifest.dataCycleId !== updates.dataCycleId
    || manifest.dataCycleManifestRevision !== updates.dataCycleManifestRevision;
  Object.assign(manifest, updates, changed ? { generatedAt: now } : { generatedAt: manifest.generatedAt || now });
  if (changed) { changedAny = true; await writeJson(relative, manifest); }
}
console.log(JSON.stringify({ ok: true, revision: snapshot.revision, cycleId: updates.dataCycleId, manifests: 2, changed: changedAny }));
