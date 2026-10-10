#!/usr/bin/env node
// Resolve the merge conflicts that every `git merge origin/main` into a version branch produces in the
// generated release manifests: the data-refresh bot rewrites dataRevision/generatedAt on main while the
// branch carries the new appRevision. Take main's side (fresh data identity) and keep the branch's
// appRevision from version.json. Any other conflicted file is left alone and reported — it needs a human.
//
// Usage: node scripts/resolve-generated-conflicts.mjs   (inside a merge with conflicts)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const GENERATED = new Set(['architecture/asset-manifest.json', 'architecture/release-manifest.json', 'public-data/operations-status.json']);
const version = JSON.parse(readFileSync('version.json', 'utf8')).version;
if (!/^v\d+\.\d+$/.test(version || '')) throw new Error(`version.json has no usable version: ${version}`);

// The merge runs in either direction: origin/main into a version branch (main = theirs) or a version
// branch into local main (main = ours). Pick the side that contains origin/main.
const isAncestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };
const mainIsOurs = isAncestor('origin/main', 'HEAD') && !isAncestor('origin/main', 'MERGE_HEAD');
const conflicted = execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const manual = conflicted.filter((file) => !GENERATED.has(file));
for (const file of conflicted.filter((name) => GENERATED.has(name))) {
  const source = readFileSync(file, 'utf8');
  const resolved = source.replace(/<<<<<<< [^\r\n]*\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\r\n]*\r?\n/g,
    (_, ours, theirs) => (mainIsOurs ? ours : theirs).replace(/"appRevision": "v[\d.]+"/g, `"appRevision": "${version}"`));
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(resolved)) throw new Error(`unresolved markers remain in ${file}`);
  JSON.parse(resolved);
  writeFileSync(file, resolved);
  execFileSync('git', ['add', file]);
  console.log(`resolved ${file} (main's data identity, appRevision ${version})`);
}
if (manual.length) {
  console.error(`needs manual resolution: ${manual.join(', ')}`);
  process.exit(1);
}
console.log('next: node scripts/ci-generated-release-parity-check.mjs && node scripts/ci-release-manifest-contract.mjs && node scripts/ci-release-revision-check.mjs');
