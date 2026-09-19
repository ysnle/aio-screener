#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ci-decomp-hotspot-check.mjs — P895 (v53.96) → P1127/R620 (v55.08)
//
// Decomposition pressure has to be a ratchet, not a wall.
//
// v53.96/P895 hardcoded three fixed caps. Two things went wrong with that shape:
//   1. The declared numbers in architecture/decomposition-hotspots.json were never
//      read — enforcement lived in this file's `limits` literal. Declaration and
//      enforcement could disagree, and did.
//   2. A fixed cap is only useful while it is far away. At js/aio-core.js the file
//      reached 27,999 against a 28,000 cap, so the gate stopped preventing growth
//      and started forbidding any change that was not net-negative — including a
//      one-line correctness fix. The only ways through were compressing comments
//      (gaming the metric) or editing the constant (silent re-baseline).
//
// The shape now: every runtime file records its current line count, and a file may
// never exceed its record. Reductions tighten automatically on --write. Growth is
// still possible, but only as a deliberate, recorded decision (--allow-growth),
// which is exactly the visibility the fixed cap pretended to provide.
//
// Usage:
//   node scripts/ci-decomp-hotspot-check.mjs                  # verify
//   node scripts/ci-decomp-hotspot-check.mjs --write          # tighten records (shrink only)
//   node scripts/ci-decomp-hotspot-check.mjs --write --allow-growth   # recorded raise
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';

const CONFIG = new URL('../architecture/decomposition-hotspots.json', import.meta.url);
const root = new URL('../', import.meta.url);
const write = process.argv.includes('--write');
const allowGrowth = process.argv.includes('--allow-growth');

const config = JSON.parse(await readFile(CONFIG, 'utf8'));
const files = config.measuredFiles || [];
const ceiling = config.ceiling || {};
const recorded = { ...(config.recordedLines || {}) };

const errors = [];
const measured = {};
for (const file of files) {
  let source;
  try {
    source = await readFile(new URL(file, root), 'utf8');
  } catch (error) {
    errors.push(`P1127/R620 measured file is unreadable: ${file} (${error.code || error.message})`);
    continue;
  }
  const lines = source.split(/\r?\n/).length;
  measured[file] = lines;
  const cap = Number(ceiling[file]);
  if (Number.isFinite(cap) && lines > cap) errors.push(`P1127/R620 ${file} line count ${lines} exceeds declared ceiling ${cap}`);
  const previous = Number(recorded[file]);
  if (!Number.isFinite(previous)) {
    errors.push(`P1127/R620 ${file} has no recorded line count — run with --write so the ratchet has a baseline`);
    continue;
  }
  if (lines > previous) {
    errors.push(`P1127/R620 ${file} grew ${previous} -> ${lines} (+${lines - previous}). Decomposition must be net-negative, or the raise must be recorded with --write --allow-growth and justified in the commit.`);
  } else if (lines < previous) {
    console.log(`[decomp] ${file} shrank ${previous} -> ${lines} (-${previous - lines}); rerun with --write to tighten the ratchet`);
  }
}

// The code map must cover every file the gate measures, so a new hotspot cannot be
// added without documenting where its section lives.
const map = await readFile(new URL('_context/CODE-MAP.md', root), 'utf8');
const uncovered = files.filter((file) => !map.includes(file) && !map.includes(file.replace('js/', '')));
if (uncovered.length) errors.push(`P1127/R620 CODE-MAP does not cover measured hotspot(s): ${uncovered.join(', ')}`);

if (write) {
  if (!allowGrowth) {
    const growth = files.filter((file) => Number.isFinite(Number(recorded[file])) && measured[file] > Number(recorded[file]));
    if (growth.length) {
      console.error('Refusing to record growth without --allow-growth:');
      for (const file of growth) console.error(` - ${file}: ${recorded[file]} -> ${measured[file]}`);
      process.exit(1);
    }
  }
  for (const file of files) if (Number.isFinite(measured[file])) recorded[file] = measured[file];
  const next = { ...config, recordedLines: recorded };
  await writeFile(CONFIG, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`[decomp] recorded ${files.length} file(s): ${files.map((file) => `${file}=${recorded[file]}`).join(', ')}`);
  process.exit(0);
}

if (errors.length) {
  console.error('Decomposition hotspot check failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
const headroom = Object.entries(ceiling)
  .map(([file, cap]) => `${file} ${cap - measured[file]}`)
  .join(', ');
console.log(`Decomposition hotspot check OK: ratchet holds for ${files.length} file(s); ceiling headroom ${headroom}.`);
