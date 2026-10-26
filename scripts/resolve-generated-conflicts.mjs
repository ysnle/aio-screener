#!/usr/bin/env node
// Resolve the merge conflicts that every `git merge origin/main` into a version branch produces in the
// generated release manifests: the data-refresh bot rewrites dataRevision/generatedAt on main while the
// branch carries the new appRevision. Resolution is the R626 field-level union implemented once in
// resolve-data-manifest-merge.mjs (data fields from main's side, code fields — appRevision,
// workerRevision, operations planes.browser.revision — from the branch's side); picking main's whole
// block would silently drop the branch's code-owned fields. Any other conflicted file is left alone
// and reported — it needs a human. After resolving, the release parity gates run.
//
// Usage: node scripts/resolve-generated-conflicts.mjs [--skip-gates]   (inside a merge with conflicts)
//   --skip-gates  do not run the release parity gates afterwards (fixture runs outside this repo)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectDataSide, resolveConflictText } from './resolve-data-manifest-merge.mjs';

const GENERATED = new Set(['architecture/asset-manifest.json', 'architecture/release-manifest.json', 'public-data/operations-status.json']);
// v58.84: the release-revision gate also runs the generated-manifest parity section; release-manifest retired into it.
const GATES = ['scripts/ci-release-revision-check.mjs'];
const scriptsDir = dirname(fileURLToPath(import.meta.url));
const skipGates = process.argv.includes('--skip-gates');
const version = JSON.parse(readFileSync('version.json', 'utf8')).version;
if (!/^v\d+\.\d+$/.test(version || '')) throw new Error(`version.json has no usable version: ${version}`);

// The merge runs in either direction: origin/main into a version branch (main = theirs) or a version
// branch into local main (main = ours). The side that contains origin/main is the data side.
const dataSide = detectDataSide();
const conflicted = execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const manual = conflicted.filter((file) => !GENERATED.has(file));
const generated = conflicted.filter((name) => GENERATED.has(name));
// Resolve everything in memory first: one unclassified field or invalid result writes nothing.
const resolved = generated.map((file) => ({ file, ...resolveConflictText(readFileSync(file, 'utf8'), { file, dataSide }) }));
for (const { file, text, blocks } of resolved) {
  const appRevision = JSON.parse(text).appRevision;
  if (appRevision !== undefined && appRevision !== version) {
    throw new Error(`${file}: resolved appRevision ${appRevision} != version.json ${version} — run node scripts/bump-version.mjs ${version} after the merge`);
  }
  writeFileSync(file, text);
  execFileSync('git', ['add', file]);
  console.log(`resolved ${file}: ${blocks} block(s), field-level (data side = ${dataSide}, appRevision ${version})`);
}
if (manual.length) {
  console.error(`needs manual resolution: ${manual.join(', ')}`);
  process.exit(1);
}
if (skipGates) {
  console.log(`next: ${GATES.map((gate) => `node ${gate}`).join(' && ')}`);
} else if (resolved.length) {
  for (const gate of GATES) {
    const run = spawnSync(process.execPath, [join(scriptsDir, '..', gate)], { stdio: 'inherit' });
    if (run.status !== 0) {
      console.error(`${gate} failed after resolution — inspect the resolved manifests before committing the merge`);
      process.exit(1);
    }
  }
  console.log('release parity gates passed');
}
