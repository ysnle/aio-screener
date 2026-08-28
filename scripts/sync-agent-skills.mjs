import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalRoot = join(root, '.claude', 'skills');
const mirrorRoot = join(root, '.agents', 'skills');
const checkOnly = process.argv.includes('--check');

const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

if (!existsSync(canonicalRoot) || !statSync(canonicalRoot).isDirectory()) {
  console.error('Canonical skill root is missing: .claude/skills');
  process.exit(1);
}

const canonicalFiles = walk(canonicalRoot);
const canonicalRelative = canonicalFiles.map((path) => relative(canonicalRoot, path)).sort();

if (checkOnly && !existsSync(mirrorRoot)) {
  console.error('Agent skill mirror synchronization failed: .agents/skills is missing.');
  process.exit(1);
}

if (!checkOnly) {
  for (const source of canonicalFiles) {
    const rel = relative(canonicalRoot, source);
    const target = join(mirrorRoot, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}

const mirrorFiles = walk(mirrorRoot);
const mirrorRelative = mirrorFiles.map((path) => relative(mirrorRoot, path)).sort();
const expected = new Set(canonicalRelative);
const actual = new Set(mirrorRelative);
const errors = [];

for (const rel of canonicalRelative) {
  if (!actual.has(rel)) {
    errors.push(`missing mirror file: ${rel}`);
    continue;
  }
  const canonical = readFileSync(join(canonicalRoot, rel));
  const mirror = readFileSync(join(mirrorRoot, rel));
  if (!canonical.equals(mirror)) errors.push(`content drift: ${rel}`);
}
for (const rel of mirrorRelative) {
  if (!expected.has(rel)) errors.push(`stale mirror-only file: ${rel}`);
}

if (errors.length) {
  console.error('Agent skill mirror synchronization failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

console.log(`Agent skill mirror OK: ${canonicalRelative.length} file(s) synchronized.`);
