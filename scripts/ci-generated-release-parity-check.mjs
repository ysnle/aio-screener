import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const targets = ['architecture/asset-manifest.json', 'architecture/release-manifest.json'];
const digest = () => Object.fromEntries(targets.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const before = digest();
const result = spawnSync(process.execPath, ['scripts/sync-data-release-manifests.mjs'], { encoding: 'utf8', stdio: 'pipe' });
if (result.status !== 0) {
  console.error(String(result.stderr || result.stdout || 'release manifest generation failed').trim());
  process.exit(1);
}
const after = digest();
const changed = targets.filter((file) => before[file] !== after[file]);
if (changed.length) {
  console.error(`Release generated parity failed; regenerated: ${changed.join(', ')}`);
  process.exit(1);
}
console.log('Release generated parity OK: asset/release manifests unchanged.');
