// R290/P653: deterministic subset of /knowledge-lint's seven passes, run on a schedule
// (.github/workflows/knowledge-lint.yml) independent of whether a session remembers to
// run the full semantic lint manually. Karpathy's LLM-wiki pattern names drift ("pages
// go stale, cross-references rot") as the #1 failure mode for any LLM-maintained wiki at
// scale; this repo's `_context/` is exactly that kind of wiki, and until now "run
// /knowledge-lint weekly" was prose-only with no forcing function. This script does not
// replace the full lint (contradiction detection, ambiguous ownership still need judgment)
// — it catches the mechanical subset that never needs judgment: file/table drift and
// stale-by-the-document's-own-declared-schedule.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};
const warn = (label, condition, detail = '') => {
  if (!condition) warnings.push(label + (detail ? ': ' + detail : ''));
};

// --- Pass A: versioned + newly-created _context/*.md files vs INDEX.md's table --------
// Include non-ignored, untracked documents so the lint is useful before staging/commit.
// The previous tracked-only query falsely reported a correctly indexed new document as
// "no longer git-tracked" during the exact local-edit window this gate is meant to cover.
// -z (NUL-separated, unquoted) avoids git's default core.quotepath behavior, which wraps any
// path containing a space or non-ASCII byte in double quotes with octal escapes (e.g. a stray
// untracked "…- 복사본.md" file would otherwise come back as the literal 4-character-escaped
// string `"_context/… \353\263\265….md"` — the plain .replace(/^_context\//, '') below wouldn't
// strip that leading quote, so join('_context', file) later would double-prefix the path and
// readFileSync would throw ENOENT on a path that never existed, crashing the whole gate).
const trackedFiles = execSync('git ls-files -z --cached --others --exclude-standard -- "_context/*.md"', { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .map((p) => p.replace(/^_context\//, ''));
const trackedSet = new Set(trackedFiles);

const indexMd = read('_context/INDEX.md');
const claudeMd = read('_context/CLAUDE.md');

const extractDocTable = (src, nameRe) => {
  const names = new Set();
  for (const m of src.matchAll(nameRe)) names.add(m[1]);
  return names;
};
// INDEX.md wraps the filename in backticks; _context/CLAUDE.md's table does not.
const indexDocs = extractDocTable(indexMd, /^\|\s*`([\w.-]+\.md)`\s*\|/gm);
const claudeMdDocs = extractDocTable(claudeMd, /^\|\s*([\w.-]+\.md)\s*\|/gm);

const missingFromIndex = [...trackedSet].filter((f) => !indexDocs.has(f));
const indexButNotTracked = [...indexDocs].filter((f) => !trackedSet.has(f));
check(
  'every versioned or newly-created _context/*.md file is listed in INDEX.md\'s document table',
  missingFromIndex.length === 0,
  missingFromIndex.join(', ')
);
check(
  'INDEX.md\'s document table does not list a missing or ignored file',
  indexButNotTracked.length === 0,
  indexButNotTracked.join(', ')
);

// --- Pass B: INDEX.md's document table vs _context/CLAUDE.md's document table ---------
// Both docs maintain a near-duplicate "which _context docs exist and why" table
// (_context/CLAUDE.md's own note calls out that INDEX.md and it must be updated together).
// They are two independently-editable lists asserting the same fact, which is exactly the
// shape of thing that drifts apart silently — R290's own rationale, applied to docs instead
// of live code.
const onlyInIndex = [...indexDocs].filter((f) => !claudeMdDocs.has(f));
const onlyInClaudeMd = [...claudeMdDocs].filter((f) => !indexDocs.has(f));
check(
  'INDEX.md and _context/CLAUDE.md document tables list the same file set',
  onlyInIndex.length === 0 && onlyInClaudeMd.length === 0,
  `only in INDEX.md: [${onlyInIndex.join(', ')}], only in _context/CLAUDE.md: [${onlyInClaudeMd.join(', ')}]`
);

// --- Pass C: staleness for docs that opt in via auto_refresh: true frontmatter --------
// Opt-in on purpose: most _context docs are intentionally frozen point-in-time audit
// snapshots (their own INDEX.md "Refresh trigger" column says so — e.g. "재감사/항목 완료
// 시"), not living documents on a calendar cadence. Only check docs that declare
// `auto_refresh: true`, which is this repo's own existing convention for "keep me current."
const STALE_DAYS = 45;
const now = Date.now();
for (const file of trackedFiles) {
  const src = read(join('_context', file));
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) continue;
  const isAutoRefresh = /auto_refresh:\s*true/.test(fm[1]);
  if (!isAutoRefresh) continue;
  const lastVerified = fm[1].match(/last_verified:\s*(\d{4}-\d{2}-\d{2})/);
  check(`${file} declares auto_refresh: true and must also declare a parseable last_verified date`, !!lastVerified);
  if (!lastVerified) continue;
  const ageDays = Math.floor((now - new Date(lastVerified[1] + 'T00:00:00Z').getTime()) / 86400000);
  warn(`${file} last_verified is ${ageDays}d old (auto_refresh: true, threshold ${STALE_DAYS}d)`, ageDays <= STALE_DAYS);
}

if (warnings.length) {
  console.warn('Knowledge lint warnings:');
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (errors.length) {
  console.error('Knowledge lint check failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Knowledge lint check OK (${trackedFiles.length} versioned/new _context/*.md files, ${warnings.length} warning(s)).`);
