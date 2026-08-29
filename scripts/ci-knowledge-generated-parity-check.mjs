import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const builders = [
  ['scripts/build-knowledge-concept-manifest.mjs'],
  ['scripts/build-principles-edge-semantics.mjs'],
  ['scripts/build-knowledge-evidence-registry.mjs'],
  ['scripts/enrich-knowledge-source-lessons.mjs'],
  ['scripts/build-knowledge-articles-and-learning-graph.mjs'],
  ['scripts/audit-knowledge-encyclopedia-depth.mjs', '--strict'],
  ['scripts/build-knowledge-route-targets.mjs'],
  ['scripts/build-ai-knowledge-retrieval-index.mjs'],
  ['scripts/build-knowledge-coverage-matrix.mjs'],
  ['scripts/build-knowledge-research-dossiers.mjs'],
  ['scripts/build-knowledge-domain-dossiers.mjs'],
  ['scripts/build-knowledge-runtime-index.mjs'],
  ['scripts/build-atlas-current-evidence-ledger.mjs'],
  ['scripts/build-13f-issuer-aggregates.mjs']
];
const targets = [
  'public-data/knowledge/concepts.json',
  'public-data/knowledge/aliases.json',
  'src/domain/knowledge/principles-edge-semantics.js',
  'public-data/knowledge/sources.json',
  'public-data/knowledge/claims.json',
  'public-data/principles/lesson-library.json',
  'public-data/atlas/foundation-lessons.json',
  'public-data/knowledge/articles.json',
  'public-data/knowledge/ai-retrieval-index.json',
  'public-data/knowledge/learning-graph.json',
  'public-data/knowledge/articles',
  'public-data/knowledge/route-targets.json',
  'public-data/knowledge/coverage-matrix.json',
  'public-data/knowledge/research-dossiers.json',
  'public-data/knowledge/research-dossiers',
  'public-data/knowledge/status-summary.json',
  'public-data/atlas/current-evidence-ledger.json',
  'public-data/atlas/index.json',
  'public-data/masters/issuer-aggregates.json',
  'public-data/masters/index.json'
];

const atomicWriterSource = readFileSync(join(root, 'scripts/lib/atomic-write.mjs'), 'utf8');
if (!/renameWithRetrySync/.test(atomicWriterSource) || !/RETRYABLE_RENAME_CODES/.test(atomicWriterSource) || !/EPERM/.test(atomicWriterSource)) {
  console.error('Knowledge generated parity failed: the shared atomic writer must preserve bounded Windows rename-lock retry handling.');
  process.exit(1);
}

for (const [script] of builders) {
  const source = readFileSync(join(root, script), 'utf8');
  if (/\bfs\.writeFileSync\s*\(|\bfs\.writeFile\s*\(/.test(source)) {
    console.error(`Knowledge generated parity failed: ${script} writes a published target directly instead of using the atomic writer.`);
    process.exit(1);
  }
}

function filesUnder(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => filesUnder(relative(root, join(absolute, entry.name))));
}

function snapshot() {
  const rows = new Map();
  for (const file of [...new Set(targets.flatMap(filesUnder))].sort()) {
    rows.set(relative(root, file).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(file)).digest('hex'));
  }
  return rows;
}

const before = snapshot();
for (const [script, ...args] of builders) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    console.error(`Knowledge generated parity failed while running ${script}:`);
    console.error(String(result.stderr || result.stdout || 'unknown builder failure').trim());
    process.exit(1);
  }
}
const after = snapshot();
const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
const changed = paths.filter((path) => before.get(path) !== after.get(path));
if (changed.length) {
  console.error('Knowledge generated parity failed: builders changed generated outputs. Review the regenerated files, then rerun.');
  changed.slice(0, 50).forEach((path) => console.error(` - ${path}`));
  if (changed.length > 50) console.error(` - ... ${changed.length - 50} more`);
  process.exit(1);
}
console.log(`Knowledge generated parity OK: ${builders.length} builders, ${after.size} generated files unchanged.`);
