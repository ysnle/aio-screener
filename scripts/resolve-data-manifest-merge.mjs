// Resolves the recurring merge/rebase conflicts between this repository's code commits and the
// scheduled data-refresh bot. Reproducible recipe: node scripts/resolve-data-manifest-merge.mjs
//
// WHY THIS IS NOT A ONE-OFF: the bot commits on its own schedule (every 1-2 hours) and always
// touches the same three files, so a long-running branch is overtaken repeatedly. Each earlier
// session rediscovered the resolution by hand, and the previous attempt in this session spent
// ~40 minutes doing it commit by commit. The conflict is not semantic — the two sides own
// DIFFERENT FIELDS of the same generated documents:
//
//   code side (this branch)  : appRevision, workerRevision
//   data side (bot, upstream): dataRevision, generatedAt, data-cycle ids, everything else
//
// So the correct merge is a field-level union, not a pick-a-side. That rule is encoded here once.
// Note the rebase polarity: during `git rebase`, `--ours` is the UPSTREAM (the bot) and `--theirs`
// is the commit being replayed (this branch). This script reads the conflict markers directly, so
// it does not depend on which side git happens to call which.
//
// Usage:
//   git rebase origin/main            # or: git merge origin/main
//   node scripts/resolve-data-manifest-merge.mjs <path> [<path> ...]
//   git add <paths> && git rebase --continue
//
// Exits non-zero and writes nothing if a conflict block contains a field that is not covered by
// the ownership rule — a new field must be classified deliberately, not guessed.

import { readFileSync, writeFileSync } from 'node:fs';

const CODE_KEYS = new Set(['appRevision', 'workerRevision']);
const START = /^<{7} /;
const MID = /^={7}$/;
const END = /^>{7} /;

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error('usage: node scripts/resolve-data-manifest-merge.mjs <conflicted-path> [...]');
  process.exit(2);
}

let totalBlocks = 0;
for (const path of paths) {
  const text = readFileSync(path, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const out = [];
  let blocks = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!START.test(lines[i])) { out.push(lines[i]); continue; }
    const ours = [];
    const theirs = [];
    i += 1;
    while (i < lines.length && !MID.test(lines[i])) { ours.push(lines[i]); i += 1; }
    i += 1;
    while (i < lines.length && !END.test(lines[i])) { theirs.push(lines[i]); i += 1; }

    const value = (list, key) => list.find((line) => line.trim().startsWith(`"${key}"`)) || null;
    const keys = new Set([...ours, ...theirs].map((line) => (/^\s*"([A-Za-z][\w-]*)"/.exec(line) || [])[1]).filter(Boolean));
    for (const key of keys) {
      if (CODE_KEYS.has(key) || ['dataRevision', 'generatedAt', 'dataGeneratedAt', 'dataCycleId', 'dataCycleManifestRevision', 'revision'].includes(key)) continue;
      console.error(`${path}: unclassified field "${key}" in a conflict block — decide which side owns it before merging`);
      process.exit(3);
    }
    // Emit the upstream line order (so the document keeps the bot's field ordering), taking the
    // code side's value only for the keys the code side owns.
    const seen = new Set();
    for (const line of ours) {
      const key = (/^\s*"([A-Za-z][\w-]*)"/.exec(line) || [])[1];
      if (!key) { out.push(line); continue; }
      seen.add(key);
      const chosen = CODE_KEYS.has(key) ? value(theirs, key) : line;
      out.push(chosen === null ? line : chosen);
    }
    for (const line of theirs) {
      const key = (/^\s*"([A-Za-z][\w-]*)"/.exec(line) || [])[1];
      if (key && seen.has(key)) continue;
      out.push(line);
    }
    blocks += 1;
  }
  writeFileSync(path, out.join(eol), 'utf8');
  console.log(`${path}: resolved ${blocks} conflict block(s)`);
  totalBlocks += blocks;
}
console.log(`resolved ${totalBlocks} block(s) across ${paths.length} file(s)`);
