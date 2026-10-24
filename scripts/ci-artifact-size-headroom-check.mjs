#!/usr/bin/env node
// P1508 (ops lesson 2026-10-06): a data refresh grew two masters files past the browser budget gates
// (filings.json 404,934 > 400,000; history-index + one manager shard 213,569 > 200,000). Nothing failed in the
// data workflow itself — the next code CI run broke on unrelated changes. This static check reads the same budgets
// against the files on disk, warns at 90% and fails above 100%, and runs in the scheduled watchdog so growth is seen
// before it blocks a release. Budgets mirror scripts/ci-three-page-artifact-budget-check.mjs; keep them in step.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEC_LEDGER_PATH } from './lib/sec-ledger.mjs';
import { SEC_STORE_PART_MAX_BYTES } from './lib/sec-ledger-store.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const size = (rel) => (existsSync(join(root, rel)) ? statSync(join(root, rel)).size : 0);

// The quarter view loads the history index plus one manager shard; the largest shard is the worst case.
function largestManagerShard() {
  try {
    const index = JSON.parse(readFileSync(join(root, 'public-data/masters/history-index.json'), 'utf8'));
    const ids = (index.managers || []).map((manager) => manager.managerId).filter(Boolean);
    return Math.max(0, ...ids.map((id) => size(`public-data/masters/history/managers/${id}.json`)));
  } catch { return 0; }
}

const BUDGETS = [
  { id: 'masters-filings', bytes: size('public-data/masters/filings.json'), budget: 460_000 },
  { id: 'masters-ownership', bytes: size('public-data/masters/filing-discovery.json'), budget: 460_000 },
  { id: 'masters-quarter-view', bytes: size('public-data/masters/history-index.json') + largestManagerShard(), budget: 260_000 },
  { id: 'masters-principles', bytes: size('public-data/masters/manager-principles.json'), budget: 10_000 },
  { id: 'masters-ticker-reference', bytes: size('public-data/masters/ticker-index-reference.json'), budget: 200_000 },
  // v57.81: lazy official US listing (~12k symbols, columnar). The client refuses more than 2 MiB (src/data/us-listings.js).
  { id: 'us-listings', bytes: size('public-data/us-listings.json'), budget: 1_200_000 },
  // v57.81: the extended screener shard is fetched only when a reader picks 확장. Estimate ~4,200 rows × ~1.2-1.5 KB
  // after row-default encoding ≈ 5-6.3 MB; the 15 MB cap leaves room for the unencoded worst case (4,200 × 2.6 KB ≈ 11 MB).
  // Over the cap, split by membership (R2000 / Nasdaq-only shards) or trim detail-only fields.
  { id: 'screener-extended-shard', bytes: size('public-data/screener-extended.json'), budget: 15_000_000 },
  { id: 'screener-extended-universe', bytes: size('public-data/screener-extended-universe.json'), budget: 1_000_000 },
  { id: 'sec-fundamentals-extended-ledger', bytes: size('public-data/sec-fundamentals-extended.json'), budget: 20_000_000 },
  // The core artifact stays the size it was (v57.81 keeps the extended rows out of it).
  { id: 'screener-core', bytes: size('public-data/screener.json'), budget: 5_000_000 },
  // v58.75 (persona review): the stock page artifacts that grew this pass, at their client read caps — fiscal history (capital
  // columns on the latest two years + issuer SIC; src/ui/components/fiscal-read.js 1 MiB), the earnings calendar (six-week
  // universe map; fiscal-read.js EARNINGS_CALENDAR 512 KiB) and consensus estimates (surprise history; 1 MiB).
  { id: 'sec-fiscal-history', bytes: size('public-data/sec-fiscal-history.json'), budget: 1_048_576 },
  { id: 'earnings-calendar', bytes: size('public-data/earnings-calendar.json'), budget: 524_288 },
  { id: 'consensus-estimates', bytes: size('public-data/consensus-estimates.json'), budget: 1_048_576 }
];

const failures = [];
const warnings = [];
for (const row of BUDGETS) {
  if (!row.bytes) continue;
  const share = row.bytes / row.budget;
  const line = `${row.id}: ${row.bytes.toLocaleString('en-US')} / ${row.budget.toLocaleString('en-US')} bytes (${Math.round(share * 100)}%)`;
  if (share > 1) failures.push(line);
  else if (share >= 0.9) warnings.push(line);
}
// GitHub warns on pushed files over 50 MB and rejects files over 100 MB. v57.89: the data bots stop a main commit
// above 50 MB (refresh-data / refresh-screener staged-file gates), and the 13F manager ledgers are split at 32 MiB
// (scripts/lib/masters-manager-store.mjs), so main-committed files fail here at the same 50 MB and warn from 40 MiB.
// The SEC ledger is not committed to main: it is force-pushed to the data-store branch. v57.90 stores it there as
// parts of at most 32 MiB (scripts/lib/sec-ledger-store.mjs), so GitHub's 100 MB per-file rejection no longer binds the
// whole file. The next wall is the single-string read every consumer does (readFileSync utf8 + JSON.parse; V8 caps a
// string near 512 MiB), so the local ledger warns from 256 MiB and stops at 400 MiB.
const MiB = 1024 * 1024;
const MAIN_COMMIT_LIMIT_BYTES = 52_428_800;
const walk = (rel) => readdirSync(join(root, rel), { withFileTypes: true }).flatMap((entry) => {
  const child = `${rel}/${entry.name}`;
  return entry.isDirectory() ? walk(child) : [{ rel: child, bytes: statSync(join(root, child)).size }];
});
const publicFiles = existsSync(join(root, 'public-data')) ? walk('public-data') : [];
for (const file of publicFiles) {
  if (file.rel === SEC_LEDGER_PATH) {
    const parts = Math.ceil(file.bytes / SEC_STORE_PART_MAX_BYTES);
    const line = `${file.rel}: ${(file.bytes / MiB).toFixed(1)} MiB (data-store branch, ~${parts} part(s) of <= 32 MiB; one-string read stops at 400 MiB)`;
    if (file.bytes >= 400 * MiB) failures.push(line);
    else if (file.bytes >= 256 * MiB) warnings.push(line);
    continue;
  }
  const line = `${file.rel}: ${(file.bytes / MiB).toFixed(1)} MiB (main data commits stop above 50 MB)`;
  if (file.bytes > MAIN_COMMIT_LIMIT_BYTES) failures.push(line);
  else if (file.bytes >= 40 * MiB) warnings.push(line);
}
for (const line of warnings) console.log(`::warning::artifact size near budget — ${line}`);
if (failures.length) {
  console.error(`Artifact size headroom check failed:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`Artifact size headroom OK: ${BUDGETS.filter((row) => row.bytes).length} budget(s), ${warnings.length} near limit.`);
