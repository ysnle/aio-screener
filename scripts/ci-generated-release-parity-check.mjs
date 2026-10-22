import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const targets = ['architecture/asset-manifest.json', 'architecture/release-manifest.json'];
const digest = () => Object.fromEntries(targets.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const before = digest();
// v58.63 (architecture audit C6): a check must not leave the tree changed — on a mismatch or a generator failure the
// manifests were left regenerated (or half written). The original bytes are restored before the gate reports.
const originals = Object.fromEntries(targets.map((file) => [file, readFileSync(file)]));
const restore = () => { for (const file of targets) writeFileSync(file, originals[file]); };
const result = spawnSync(process.execPath, ['scripts/sync-data-release-manifests.mjs'], { encoding: 'utf8', stdio: 'pipe' });
if (result.status !== 0) {
  restore();
  console.error(String(result.stderr || result.stdout || 'release manifest generation failed').trim());
  process.exit(1);
}
const after = digest();
const changed = targets.filter((file) => before[file] !== after[file]);
if (changed.length) {
  restore();
  console.error(`Release generated parity failed; regenerating would change: ${changed.join(', ')} (restored; run node scripts/sync-data-release-manifests.mjs to update)`);
  process.exit(1);
}
console.log('Release generated parity OK: asset/release manifests unchanged.');
