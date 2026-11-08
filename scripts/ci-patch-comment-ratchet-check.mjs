#!/usr/bin/env node
// scripts/ci-patch-comment-ratchet-check.mjs — v59.84 (recurrence analysis S5)
//
// Product code carried 3,853 comments of the form "// v59.70 (…): this used to … now …" and 1,703 P numbers. Each fix
// wrote its history into the file it patched, so a reader had to replay the comments to learn the current rule, and a
// new sentence or branch was easier to add than the old one was to find. History lives in git and the ledger
// (scripts/why-trace.mjs, scripts/prior-fixes.mjs); a comment says what the code does now.
//
// The per-file count of comment lines that name a release (v52.1–v99.99) or a postmortem id (P1000–P9999) may shrink but
// may not grow, and a file without such comments may not start carrying them. A new reason worth keeping in the file is
// written as the rule itself, without the release tag.
//
// Usage:
//   node scripts/ci-patch-comment-ratchet-check.mjs           # verify
//   node scripts/ci-patch-comment-ratchet-check.mjs --write   # record the current counts (only after a shrink)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const BASELINE_PATH = '_context/patch-comment-baseline.json';
const SCAN = ['src', 'js'];
const TAG = /\b(?:v(?:5[2-9]|[6-9]\d)\.\d{1,2}|P[1-9]\d{3})\b/;

/** Comment lines (// … and lines inside /* … *\/ blocks) that name a release or a P id. */
export function countPatchComments(source) {
  let count = 0, inBlock = false;
  for (const line of String(source).split('\n')) {
    const trimmed = line.trim();
    if (inBlock) {
      if (TAG.test(trimmed)) count += 1;
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    const at = line.indexOf('//');
    const block = line.indexOf('/*');
    if (at >= 0 && (block < 0 || at < block) && !/['"`][^'"`]*\/\/[^'"`]*['"`]/.test(line.slice(0, at + 2)) && !/https?:$/.test(line.slice(0, at))) {
      if (TAG.test(line.slice(at))) count += 1;
    } else if (block >= 0) {
      if (TAG.test(line.slice(block))) count += 1;
      if (!line.slice(block).includes('*/')) inBlock = true;
    }
  }
  return count;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) walk(path, out);
    else if (/\.m?js$/.test(name.name)) out.push(path);
  }
  return out;
}

const counts = {};
for (const base of SCAN) for (const file of walk(join(root, base))) {
  const n = countPatchComments(readFileSync(file, 'utf8'));
  if (n) counts[relative(root, file).replace(/\\/g, '/')] = n;
}
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

if (write) {
  writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({ schema: 'patch-comment-baseline.v1', total, files: Object.fromEntries(Object.entries(counts).sort()) }, null, 2)}\n`);
  console.log(`Patch-comment baseline written: ${Object.keys(counts).length} files, ${total} comment lines.`);
  process.exit(0);
}

const baseline = existsSync(join(root, BASELINE_PATH)) ? JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8')) : null;
if (!baseline) { console.error(`Patch-comment ratchet: ${BASELINE_PATH} is missing; run with --write once.`); process.exit(1); }
const grew = Object.entries(counts).filter(([file, n]) => n > (baseline.files[file] || 0)).map(([file, n]) => `${file}: ${baseline.files[file] || 0} → ${n}`);
if (grew.length) {
  console.error(`Patch-comment ratchet failed — ${grew.length} file(s) gained release/P-tagged comments. Say what the code does now, without the tag; the history is in git and the ledger:\n - ${grew.join('\n - ')}`);
  process.exit(1);
}
const shrank = Object.entries(baseline.files).filter(([file, n]) => (counts[file] || 0) < n).length;
console.log(`Patch-comment ratchet OK: ${Object.keys(counts).length} files, ${total} tagged comment lines${shrank ? ` (${shrank} files shrank — run --write to lock in)` : ''}.`);
