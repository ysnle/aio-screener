// S17~S19 (D8): writes the research artifacts the screens fetch from their single source in content/research.
//   node scripts/build-research-content.mjs          write public-data outputs
//   node scripts/build-research-content.mjs --check  exit 1 when an output differs from a fresh build
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomicWriteFileSync } from './lib/atomic-write.mjs';
import { repoRoot, researchContentArtifacts, serializeResearchArtifact as serialize } from './lib/research-content.mjs';

const check = process.argv.includes('--check');
const stale = [];
for (const [path, value] of researchContentArtifacts()) {
  const target = resolve(repoRoot, path);
  if (check) {
    let current = null;
    try { current = readFileSync(target, 'utf8'); } catch { /* missing counts as stale */ }
    if (current !== serialize(value)) stale.push(path);
  } else {
    atomicWriteFileSync(target, serialize(value));
  }
}
if (check && stale.length) {
  console.error(`[research-content] stale: ${stale.join(', ')} — run node scripts/build-research-content.mjs`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, mode: check ? 'check' : 'write', artifacts: researchContentArtifacts().length }));
