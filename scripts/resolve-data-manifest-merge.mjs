// Resolves the recurring merge/rebase conflicts between this repository's code commits and the
// scheduled data-refresh bot. Reproducible recipe: node scripts/resolve-data-manifest-merge.mjs
//
// WHY THIS IS NOT A ONE-OFF: the bot commits on its own schedule (every 1-2 hours) and always
// touches the same three files, so a long-running branch is overtaken repeatedly. Each earlier
// session rediscovered the resolution by hand, and the previous attempt in this session spent
// ~40 minutes doing it commit by commit. The conflict is not semantic — the two sides own
// DIFFERENT FIELDS of the same generated documents:
//
//   code side (this branch)  : appRevision, workerRevision (+ manifest-only static fields)
//   data side (bot, upstream): dataRevision, generatedAt, data-cycle ids, everything else
//
// So the correct merge is a field-level union, not a pick-a-side. That rule is encoded here once.
// Ownership is per-file: the two architecture manifests carry code-only static fields (evidenceRevision,
// schemaVersion, status, rollback.*, ...) that no automated writer touches — they are pinned by
// ci-architecture-contract-check.mjs and change only through code commits. The same key names can be
// bot-owned in other files (e.g. "status" in public-data/market-snapshot.json), so those extensions
// must never leak into the generic table.
//
// public-data/operations-status.json is produced entirely by the data bot except for the two fields a
// version bump rewrites (bump-version.mjs): top-level appRevision and planes.browser.revision. Its policy
// is therefore path-based — those two paths are code-owned, every other field is data-owned. The generic
// key "revision" stays data-owned elsewhere (ai.publicChat.health.revision is a live observation).
//
// Polarity: during `git rebase`, `--ours` is the UPSTREAM (the bot) and `--theirs` is the commit being
// replayed (this branch); during `git merge origin/main` on a version branch it is the other way round.
// The data side is therefore an explicit input (--data-side ours|theirs). Without the flag the script
// asks git which side carries origin/main (the rule resolve-generated-conflicts.mjs uses) and falls
// back to `ours` (rebase polarity) when that cannot be determined.
//
// Usage:
//   git rebase origin/main            # or: git merge origin/main
//   node scripts/resolve-data-manifest-merge.mjs [--data-side ours|theirs] <path> [<path> ...]
//   git add <paths> && git rebase --continue
// (node scripts/resolve-generated-conflicts.mjs runs this for every conflicted generated manifest.)
//
// Exits non-zero and writes nothing if a conflict block contains a field that is not covered by
// the ownership rule — a new field must be classified deliberately, not guessed — or if a resolved
// .json document does not parse.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE_KEYS = new Set(['appRevision', 'workerRevision']);
const DATA_KEYS = ['dataRevision', 'generatedAt', 'dataGeneratedAt', 'dataCycleId', 'dataCycleManifestRevision', 'revision'];
// Fields only ever changed by code commits in the two architecture manifests. Classified deliberately
// (R626(4)) after verifying writers: sync-data-release-manifests.mjs writes only DATA_KEYS, and
// bump-version.mjs touches only appRevision/workerRevision here.
const MANIFEST_CODE_KEYS = new Set(['evidenceRevision', 'schemaVersion', 'publicSource', 'assetManifest', 'serviceWorker', 'immutableRuntime', 'status', 'rollback', 'strategy', 'appDataIndependent', 'workerCacheIndependent', 'lastKnownGood']);
const MANIFEST_PATHS = new Set(['asset-manifest.json', 'release-manifest.json']);
// Path-based policies (R626(4), classified by writer): listed JSON paths are code-owned, the rest data-owned.
const PATH_POLICIES = {
  'operations-status.json': { codePaths: new Set(['appRevision', 'planes.browser.revision']) }
};
const START = /^<{7} /;
const BASE = /^\|{7}(?: |$)/;
const MID = /^={7}$/;
const END = /^>{7} /;
const KEY = /^\s*"([^"\\]+)"\s*:/;

export class UnclassifiedFieldError extends Error {}

function ownerFor(file) {
  const name = String(file).replace(/\\/g, '/').split('/').pop();
  if (PATH_POLICIES[name]) {
    const { codePaths } = PATH_POLICIES[name];
    return (key, path) => (codePaths.has(path) ? 'code' : 'data');
  }
  const codeKeys = MANIFEST_PATHS.has(name) ? new Set([...CODE_KEYS, ...MANIFEST_CODE_KEYS]) : CODE_KEYS;
  return (key) => (codeKeys.has(key) ? 'code' : DATA_KEYS.includes(key) ? 'data' : null);
}

// Tracks the JSON path through pretty-printed (one member per line) documents; the root is unnamed.
function advance(stack, line) {
  const trimmed = line.trim();
  const opener = /^"([^"\\]+)"\s*:\s*[[{]\s*$/.exec(trimmed);
  if (opener) return [...stack, opener[1]];
  if (/^[[{]\s*$/.test(trimmed)) return [...stack, '*'];
  if (/^[\]}],?\s*$/.test(trimmed)) return stack.slice(0, -1);
  return stack;
}
const pathOf = (stack, key) => [...stack.slice(1).filter((part) => part !== '*'), key].join('.');

function annotate(lines, startStack) {
  let stack = startStack;
  const rows = lines.map((line) => {
    const key = (KEY.exec(line) || [])[1] || null;
    const row = { line, key, scalar: !!key && !/[[{]\s*$/.test(line.trim()), path: key ? pathOf(stack, key) : null };
    stack = advance(stack, line);
    return row;
  });
  return { rows, stack };
}

/** Resolves every conflict block in `text`. Returns { text, blocks }; throws UnclassifiedFieldError. */
export function resolveConflictText(text, { file, dataSide = 'ours' }) {
  if (!['ours', 'theirs'].includes(dataSide)) throw new Error(`dataSide must be ours|theirs, got ${dataSide}`);
  const owner = ownerFor(file);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const out = [];
  let stack = [];
  let blocks = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!START.test(lines[i])) { out.push(lines[i]); stack = advance(stack, lines[i]); continue; }
    const ours = [];
    const theirs = [];
    i += 1;
    while (i < lines.length && !MID.test(lines[i]) && !BASE.test(lines[i])) { ours.push(lines[i]); i += 1; }
    while (i < lines.length && !MID.test(lines[i])) i += 1; // diff3 base section, if any
    i += 1;
    while (i < lines.length && !END.test(lines[i])) { theirs.push(lines[i]); i += 1; }
    if (i >= lines.length) throw new Error(`${file}: unterminated conflict block`);

    const data = annotate(dataSide === 'ours' ? ours : theirs, stack);
    const code = annotate(dataSide === 'ours' ? theirs : ours, stack);
    for (const row of [...data.rows, ...code.rows]) {
      if (row.scalar && !owner(row.key, row.path)) {
        throw new UnclassifiedFieldError(`${file}: unclassified field "${row.path}" in a conflict block — decide which side owns it before merging`);
      }
    }
    // Emit the data side's line order (the bot's field ordering), taking the code side's value only for
    // the fields the code side owns; the data side's trailing comma is kept so the JSON stays valid.
    const codeByPath = new Map(code.rows.filter((row) => row.scalar).map((row) => [row.path, row.line]));
    const seen = new Set();
    for (const row of data.rows) {
      if (row.key) seen.add(row.path);
      const codeLine = row.scalar && owner(row.key, row.path) === 'code' ? codeByPath.get(row.path) : undefined;
      out.push(codeLine === undefined ? row.line : codeLine.replace(/,\s*$/, '') + (/,\s*$/.test(row.line) ? ',' : ''));
    }
    // A code-owned member present only on the code side (a new field) is appended; the code side's
    // copy of data-owned structure is never duplicated.
    for (const row of code.rows) {
      if (row.scalar && !seen.has(row.path) && owner(row.key, row.path) === 'code') out.push(row.line);
    }
    stack = data.stack;
    blocks += 1;
  }
  const resolved = out.join(eol);
  if (/\.json$/i.test(String(file))) {
    try { JSON.parse(resolved); } catch (error) { throw new Error(`${file}: resolved document is not valid JSON (${error.message})`); }
  }
  return { text: resolved, blocks };
}

/** Which conflict side carries origin/main (the data bot's line): 'ours' or 'theirs'. */
export function detectDataSide(cwd = process.cwd()) {
  const git = (args) => { try { execFileSync('git', args, { cwd, stdio: 'ignore' }); return true; } catch { return false; } };
  if (!git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'])) return 'ours';
  const mainInHead = git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
  const mainInMerge = git(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']) && git(['merge-base', '--is-ancestor', 'origin/main', 'MERGE_HEAD']);
  return mainInMerge && !mainInHead ? 'theirs' : 'ours';
}

function main(argv) {
  const args = argv.slice(2);
  const sideIndex = args.indexOf('--data-side');
  const dataSide = sideIndex >= 0 ? args[sideIndex + 1] : detectDataSide();
  const paths = args.filter((arg, index) => !arg.startsWith('--') && !(sideIndex >= 0 && index === sideIndex + 1));
  if (!paths.length || !['ours', 'theirs'].includes(dataSide)) {
    console.error('usage: node scripts/resolve-data-manifest-merge.mjs [--data-side ours|theirs] <conflicted-path> [...]');
    process.exit(2);
  }
  const results = [];
  try {
    for (const path of paths) results.push({ path, ...resolveConflictText(readFileSync(path, 'utf8'), { file: path, dataSide }) });
  } catch (error) {
    console.error(error.message);
    process.exit(error instanceof UnclassifiedFieldError ? 3 : 1);
  }
  let totalBlocks = 0;
  for (const { path, text, blocks } of results) {
    writeFileSync(path, text, 'utf8');
    console.log(`${path}: resolved ${blocks} conflict block(s) (data side = ${dataSide})`);
    totalBlocks += blocks;
  }
  console.log(`resolved ${totalBlocks} block(s) across ${paths.length} file(s)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
