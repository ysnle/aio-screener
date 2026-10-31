#!/usr/bin/env node
// scripts/ci-pipeline-semantics-check.mjs — v59.45
//
// Meaning-level regressions from the 2026-10-24..31 pipeline review (Codex PASS2–PASS30, Claude follow-up).
// Each `scripts/fixtures/pipeline-semantics/<area>.mjs` exports `cases`: [{ id, name, run }], where `id` is the
// review finding (e.g. P26-NAMES-01) and `run({ load })` throws when the defect condition comes back. The cases
// call the real domain/producer functions with small fixed inputs: missing must stay missing, ties must not rank,
// future observations must not count as current, and a failed collection must not erase the last good one.
//
// Usage: node scripts/ci-pipeline-semantics-check.mjs [--only <area>]

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'scripts/fixtures/pipeline-semantics');
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > -1 ? process.argv[onlyAt + 1] : null;
const load = (rel) => import(pathToFileURL(join(root, rel)));
const errors = [];
let total = 0;

const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.mjs')).sort() : [];
if (!files.length) errors.push('v59.45 pipeline-semantics fixtures exist: scripts/fixtures/pipeline-semantics/*.mjs');
const seen = new Map();
for (const file of files) {
  const area = file.replace(/\.mjs$/, '');
  if (only && area !== only) continue;
  const module = await import(pathToFileURL(join(dir, file)));
  const cases = Array.isArray(module.cases) ? module.cases : [];
  if (!cases.length) errors.push(`v59.45 ${file} exports a non-empty cases array`);
  for (const item of cases) {
    const key = `${item.id} ${item.name}`;
    if (!item.id || !item.name || typeof item.run !== 'function') { errors.push(`v59.45 ${file} case has id, name and run: ${JSON.stringify(item.id || item.name)}`); continue; }
    if (seen.has(key)) errors.push(`v59.45 duplicate case "${key}" in ${file} and ${seen.get(key)}`);
    seen.set(key, file);
    total += 1;
    try { await item.run({ load }); }
    catch (error) { errors.push(`${item.id} (${area}) ${item.name}: ${error?.message?.split('\n')[0] || error}`); }
  }
}

if (errors.length) {
  console.error(`pipeline semantics: ${errors.length} failure(s) of ${total} case(s)`);
  for (const line of errors) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`pipeline semantics: ${total} case(s) passed across ${only ? 1 : files.length} area(s)`);
