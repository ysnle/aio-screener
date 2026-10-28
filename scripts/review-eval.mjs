#!/usr/bin/env node
// scripts/review-eval.mjs — v59.42
//
// Reviewer eval built from real incidents (REVIEW.md "리뷰어를 고치는 방법"). Each line of
// architecture/review-eval-cases.jsonl is a bug case (the commit that introduced a later P-entry defect, with the
// faulty lines) or a clean case (a commit nothing later fixed). Rerun the set whenever the reviewer prompt,
// REVIEW.md, tools or model change; keep the change only if recall holds without new harmful findings on clean cases.
//
// Usage:
//   node scripts/review-eval.mjs --check                 # case shape, ids, shas, files and line ranges
//   node scripts/review-eval.mjs --packet <id>           # blind brief: a base+head-only checkout + diff (no case id or answer)
//   node scripts/review-eval.mjs --score <findings.json> # {"<id>": [{"file": "...", "line": 120}, ...], ...}

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = 'architecture/review-eval-cases.jsonl';
const LINE_SLACK = 5; // a finding counts when it lands within this many lines of the faulty range
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const [mode, arg] = process.argv.slice(2);

const cases = readFileSync(join(root, CASES), 'utf8').split('\n').filter((line) => line.trim()).map((line, index) => {
  try { return JSON.parse(line); } catch (error) { return { parseError: `line ${index + 1}: ${error.message}` }; }
});

if (mode === '--check') {
  const errors = [];
  const shallow = git('rev-parse', '--is-shallow-repository').stdout.trim() === 'true';
  const ids = new Set();
  let unresolved = 0;
  for (const item of cases) {
    if (item.parseError) { errors.push(item.parseError); continue; }
    const where = item.id || '(no id)';
    if (!item.id || ids.has(item.id)) errors.push(`${where}: missing or duplicate id`);
    ids.add(item.id);
    if (!['bug', 'clean'].includes(item.kind)) errors.push(`${where}: kind must be bug or clean`);
    if (!item.base || !item.head || !item.summary) errors.push(`${where}: base, head and summary are required`);
    if (item.kind === 'bug' && (!item.p || !item.bug_file || !Array.isArray(item.bug_lines) || item.bug_lines.length !== 2 || item.bug_lines[0] > item.bug_lines[1])) errors.push(`${where}: a bug case needs p, bug_file and bug_lines [start, end]`);
    const missing = [item.base, item.head].filter((sha) => sha && git('cat-file', '-e', `${sha}^{commit}`).status !== 0);
    // A shallow clone (CI) may not hold old commits; a full clone must.
    if (missing.length) { if (shallow) unresolved += 1; else errors.push(`${where}: commit ${missing.join(', ')} not found`); continue; }
    if (item.kind === 'bug' && item.bug_file) {
      const file = git('show', `${item.head}:${item.bug_file}`);
      if (file.status !== 0) errors.push(`${where}: ${item.bug_file} does not exist at ${item.head}`);
      else if (item.bug_lines?.[1] > file.stdout.split('\n').length) errors.push(`${where}: bug_lines end past the end of ${item.bug_file}`);
    }
  }
  const bugs = cases.filter((item) => item.kind === 'bug').length;
  if (errors.length) { console.error('Review eval cases failed:'); errors.forEach((error) => console.error(` - ${error}`)); process.exit(1); }
  console.log(`Review eval cases OK: ${bugs} bug, ${cases.length - bugs} clean${unresolved ? ` (${unresolved} case(s) not in this shallow clone)` : ''}.`);
} else if (mode === '--packet' && arg) {
  const item = cases.find((entry) => entry.id === arg);
  if (!item) { console.error(`no case ${arg}`); process.exit(2); }
  const diff = git('diff', '--stat', item.base, item.head);
  // An unreadable diff would hand the reviewer nothing and score as a miss; stop instead.
  if (diff.status !== 0 || !diff.stdout.trim()) { console.error(`cannot read ${item.base}..${item.head} here (shallow clone or pruned commit): ${diff.stderr.trim()}`); process.exit(1); }
  // Blind: a fresh repository holding only the base and head commits — no refs, no later history, no case file, and a
  // random directory name, so neither the path nor git metadata tells the reviewer the case id, kind or fix.
  const dir = mkdtempSync(join(tmpdir(), 'aio-review-'));
  const inDir = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const step of [['init', '-q'], ['fetch', '-q', '--no-tags', '--depth=1', pathToFileURL(root).href, item.base, item.head], ['checkout', '-q', '--detach', item.head]]) {
    const result = inDir(...step);
    if (result.status !== 0) { console.error(`git ${step[0]} failed in ${dir}: ${result.stderr.trim()}`); rmSync(dir, { recursive: true, force: true }); process.exit(1); }
  }
  // The REVIEW.md under test goes into the checkout: old heads predate it, and it names no case answers.
  copyFileSync(join(root, 'REVIEW.md'), join(dir, 'REVIEW.md'));
  const shown = dir.replace(/\\/g, '/');
  console.log([
    `Review only. Do not edit, commit or push. Work in "${shown}" (it holds only the base and head commits).`,
    'Read REVIEW.md there first (the review contract under test). Do not open any other copy of this project.',
    `Review the change: git diff ${item.base} HEAD; read surrounding code in that checkout.`,
    'Reply with findings as JSON: [{"file": "<path>", "line": <number>, "tag": "Important|Pre-existing", "claim": "<failure>"}], or [] for no findings.',
    '', diff.stdout
  ].join('\n'));
  // The reviewer stays read-only; whoever ran --packet deletes the checkout after scoring.
  console.error(`checkout: ${shown} (delete after scoring: rm -rf "${shown}")`);
} else if (mode === '--score' && arg) {
  const findings = JSON.parse(readFileSync(resolve(arg), 'utf8'));
  const hit = (item, list) => list.some((f) => f.file === item.bug_file && f.line >= item.bug_lines[0] - LINE_SLACK && f.line <= item.bug_lines[1] + LINE_SLACK);
  const scored = cases.filter((item) => Object.hasOwn(findings, item.id));
  const bugs = scored.filter((item) => item.kind === 'bug');
  const clean = scored.filter((item) => item.kind === 'clean');
  const hits = bugs.filter((item) => hit(item, findings[item.id]));
  const cleanFindings = clean.reduce((sum, item) => sum + findings[item.id].filter((f) => f.tag !== 'Pre-existing').length, 0);
  for (const item of bugs) console.log(`${hit(item, findings[item.id]) ? 'HIT ' : 'MISS'} ${item.id} ${item.bug_file}:${item.bug_lines.join('-')}`);
  console.log(`recall ${hits.length}/${bugs.length}; findings on clean cases ${cleanFindings} (read each: only harmful ones count); unscored cases ${cases.length - scored.length}`);
} else {
  console.error('usage: node scripts/review-eval.mjs --check | --packet <id> | --score <findings.json>');
  process.exit(2);
}
