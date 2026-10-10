#!/usr/bin/env node
// P1508 (ops lesson 2026-10-06): a data refresh grew two masters files past the browser budget gates
// (filings.json 404,934 > 400,000; history-index + one manager shard 213,569 > 200,000). Nothing failed in the
// data workflow itself — the next code CI run broke on unrelated changes. This static check reads the same budgets
// against the files on disk, warns at 90% and fails above 100%, and runs in the scheduled watchdog so growth is seen
// before it blocks a release. Budgets mirror scripts/ci-three-page-artifact-budget-check.mjs; keep them in step.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  { id: 'masters-ticker-reference', bytes: size('public-data/masters/ticker-index-reference.json'), budget: 200_000 }
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
// GitHub warns on pushed files over 50 MB and rejects files over 100 MB. The data bot commits the 13F
// manager ledgers (largest ~58 MiB on 2026-10-10), so a rejected push would silently halt every refresh.
const MiB = 1024 * 1024;
const walk = (rel) => readdirSync(join(root, rel), { withFileTypes: true }).flatMap((entry) => {
  const child = `${rel}/${entry.name}`;
  return entry.isDirectory() ? walk(child) : [{ rel: child, bytes: statSync(join(root, child)).size }];
});
const publicFiles = existsSync(join(root, 'public-data')) ? walk('public-data') : [];
for (const file of publicFiles) {
  const line = `${file.rel}: ${(file.bytes / MiB).toFixed(1)} MiB (GitHub push limit 100 MB)`;
  if (file.bytes >= 90 * MiB) failures.push(line);
  else if (file.bytes >= 50 * MiB) warnings.push(line);
}
for (const line of warnings) console.log(`::warning::artifact size near budget — ${line}`);
if (failures.length) {
  console.error(`Artifact size headroom check failed:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`Artifact size headroom OK: ${BUDGETS.filter((row) => row.bytes).length} budget(s), ${warnings.length} near limit.`);
