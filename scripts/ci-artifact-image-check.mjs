#!/usr/bin/env node
// v59.83 (hosting review 2026-11-08, option B held): screenshots under _artifacts were the largest source of history growth,
// not the data bot. Over 14 days the new _artifacts blobs packed to 182 MB then 55 MB a week, against 23–24 MB for the
// deployed public-data. They were 2,101 PNGs (245 MB raw), mostly tracked evidence images that local gate runs rewrote on
// every run (responsive-browser 916, entity-quality 627) and review screenshots (wave2-d/screens 30 MB in one week). Git
// keeps every rewritten version for good, so even an image deleted later still costs its full size.
//
// Rule: an image under _artifacts is tracked only when it is in architecture/artifact-image-baseline.json with the same
// blob id. A new image fails, and so does a tracked image whose bytes changed. .gitignore ignores _artifacts images, so a
// screenshot written by a local run or a commit-all never reaches the index without `git add -f`. Review screenshots stay
// on disk (ignored) or go to an Actions artifact.
//
//   node scripts/ci-artifact-image-check.mjs                check the index against the baseline
//   node scripts/ci-artifact-image-check.mjs --prune        drop baseline entries that are no longer tracked (never adds)
//   node scripts/ci-artifact-image-check.mjs --allow <path> accept one deliberately tracked image (git add -f it first)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'architecture/artifact-image-baseline.json';
export const IMAGE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'gif', 'webp']);
export const IGNORE_RULES = Object.freeze(IMAGE_EXTENSIONS.map((ext) => `_artifacts/**/*.${ext}`));
const isImage = (path) => path.startsWith('_artifacts/') && IMAGE_EXTENSIONS.includes(path.split('.').pop().toLowerCase());

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${String(result.stderr || '').trim()}`);
  return result.stdout;
}

/** Tracked images under _artifacts in the index: { path: blob }. */
export function trackedImages() {
  const files = {};
  for (const line of git(['ls-files', '-s', '-z', '--', '_artifacts']).split('\0')) {
    if (!line) continue;
    const [meta, path] = line.split('\t');
    if (isImage(path)) files[path] = meta.split(' ')[1];
  }
  return files;
}

/** Pure comparison: index images against baseline files. */
export function compareImages(tracked, baseline) {
  const added = [];
  const rewritten = [];
  for (const [path, blob] of Object.entries(tracked)) {
    if (!(path in baseline)) added.push(path);
    else if (baseline[path] !== blob) rewritten.push(path);
  }
  const untracked = Object.keys(baseline).filter((path) => !(path in tracked));
  return { added: added.sort(), rewritten: rewritten.sort(), untracked: untracked.sort() };
}

const readBaseline = () => JSON.parse(readFileSync(join(root, BASELINE), 'utf8'));
function writeBaseline(document, files) {
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(join(root, BASELINE), `${JSON.stringify({ ...document, fileCount: Object.keys(sorted).length, files: sorted }, null, 1)}\n`);
}

function main() {
  const args = process.argv.slice(2);
  const known = new Set(['--prune', '--allow']);
  for (let i = 0; i < args.length; i += 1) {
    if (!known.has(args[i])) throw new Error(`unknown argument ${args[i]}`);
    if (args[i] === '--allow') i += 1;
  }
  const document = readBaseline();
  const tracked = trackedImages();
  if (args.includes('--allow')) {
    const path = args[args.indexOf('--allow') + 1];
    if (!path || !(path in tracked)) throw new Error(`--allow needs a tracked _artifacts image (git add -f it first): ${path}`);
    writeBaseline(document, { ...document.files, [path]: tracked[path] });
    console.log(`[artifact-image] accepted ${path}`);
    return;
  }
  if (args.includes('--prune')) {
    const kept = Object.fromEntries(Object.entries(document.files).filter(([path]) => path in tracked));
    writeBaseline(document, kept);
    console.log(`[artifact-image] baseline ${Object.keys(document.files).length} -> ${Object.keys(kept).length}`);
    return;
  }

  const errors = [];
  const { added, rewritten, untracked } = compareImages(tracked, document.files);
  const show = (list) => list.slice(0, 8).join(', ') + (list.length > 8 ? ` (+${list.length - 8} more)` : '');
  if (added.length) errors.push(`${added.length} new tracked image(s) under _artifacts: ${show(added)}. Keep screenshots out of git (they stay ignored on disk), or run --allow <path> for a deliberate small reference image.`);
  if (rewritten.length) errors.push(`${rewritten.length} tracked image(s) under _artifacts changed bytes: ${show(rewritten)}. A run that rewrites tracked evidence images grows history on every run; untrack them (git rm --cached) and --prune.`);
  if (untracked.length) errors.push(`${untracked.length} baseline image(s) are no longer tracked: ${show(untracked)}. Run --prune.`);
  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8').split(/\r?\n/).map((line) => line.trim());
  const missingRules = IGNORE_RULES.filter((rule) => !gitignore.includes(rule));
  if (missingRules.length) errors.push(`.gitignore is missing ${missingRules.join(', ')}`);
  for (const ext of IMAGE_EXTENSIONS) {
    const probe = `_artifacts/aio-image-probe/shot.${ext}`;
    if (spawnSync('git', ['check-ignore', '-q', '--no-index', probe], { cwd: root }).status !== 0) errors.push(`${probe} is not ignored`);
  }
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }
  console.log(`PASS artifact images: ${Object.keys(tracked).length} tracked, all in the baseline with unchanged bytes; new _artifacts images are ignored`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (error) { console.error(`FAIL ${error.message}`); process.exit(1); }
}
