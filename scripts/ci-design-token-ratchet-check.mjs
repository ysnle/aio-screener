#!/usr/bin/env node
// scripts/ci-design-token-ratchet-check.mjs — v59.88 design-token adoption (astryx principles, _context/DESIGN-TOKENS.md)
//
// The :root tokens in index.html were defined but mostly bypassed: 4px corners were written as literals 246 times against
// 21 var() uses, 13px and 11px text sat outside the four-size scale (12 · 14 · 18 · 28), and 888 `!important` flags let
// a later layer repaint an earlier one instead of replacing it. A token vocabulary only holds if consumers cannot drift
// from it (astryx theme-tokens INV7), so three counts per stylesheet are frozen here; they may shrink, never grow:
//   radiusLiteral — a `border-radius` (or a corner longhand) written with a px number instead of a role token
//                   (--radius-inner / -element / -container / -full); 0 and 50% are not counted
//   offScale      — `font-size: Npx` with N ≥ 12 outside 12 · 14 · 18 · 28 (below 12 is ci-inline-style-ratchet's floor)
//   important     — `!important` flags
// New styling uses the role tokens; replace a repainting rule rather than out-ranking it.
//
// Usage:
//   node scripts/ci-design-token-ratchet-check.mjs           # verify
//   node scripts/ci-design-token-ratchet-check.mjs --write   # record shrinks (growth is refused)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = '_context/design-token-baseline.json';
const SCALE = new Set([12, 14, 18, 28]);
const KEYS = ['radiusLiteral', 'offScale', 'important'];

const RADIUS_RE = /border-(?:(?:top|bottom)-(?:left|right)-|(?:start|end)-(?:start|end)-)?radius\s*:\s*([^;}]+)/g;
const FONT_RE = /font-size\s*:\s*(\d+(?:\.\d+)?)px/g;

export function countTokens(source) {
  const text = String(source);
  let radiusLiteral = 0;
  for (const match of text.matchAll(RADIUS_RE)) if (/(?:^|[\s(,])(?!0px)\d+(?:\.\d+)?px/.test(match[1])) radiusLiteral += 1;
  let offScale = 0;
  for (const match of text.matchAll(FONT_RE)) { const px = Number(match[1]); if (px >= 12 && !SCALE.has(px)) offScale += 1; }
  const important = (text.match(/!\s*important/g) || []).length;
  return { radiusLiteral, offScale, important };
}

function styleFiles() {
  const dir = 'src/ui/styles';
  const css = readdirSync(join(root, dir)).filter((name) => name.endsWith('.css')).map((name) => `${dir}/${name}`);
  return ['index.html', ...css].sort();
}

function measure() {
  const counts = {};
  for (const file of styleFiles()) {
    const result = countTokens(readFileSync(join(root, file), 'utf8'));
    if (KEYS.some((key) => result[key])) counts[file] = result;
  }
  return counts;
}

const REMEDY = {
  radiusLiteral: 'use var(--radius-inner|element|container|full) — radius follows role',
  offScale: 'use 12 · 14 · 18 · 28px (owner four-size scale)',
  important: 'replace the rule it repaints instead of out-ranking it',
};

export function compareToBaseline(counts, baseline) {
  const failures = [];
  for (const [file, now] of Object.entries(counts)) {
    const allowed = baseline[file] || { radiusLiteral: 0, offScale: 0, important: 0 };
    for (const key of KEYS) if (now[key] > (allowed[key] || 0)) failures.push(`${file}: ${key} grew ${allowed[key] || 0} → ${now[key]} — ${REMEDY[key]}`);
  }
  return failures;
}

const totals = (counts) => Object.values(counts).reduce((sum, item) => ({
  radiusLiteral: sum.radiusLiteral + item.radiusLiteral, offScale: sum.offScale + item.offScale, important: sum.important + item.important,
}), { radiusLiteral: 0, offScale: 0, important: 0 });

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const fixture = [
    '.a { border-radius: 8px; } .b { border-radius: var(--radius-element); } .c { border-radius: 50%; } .d { border-radius: 0; }',
    '.e { border-top-left-radius: 12px !important; } .f { border-radius: calc(var(--radius-element) - 2px); }',
    '.g { font-size: 13px; } .h { font-size: 14px; } .i { font-size: 11px; } .j { font-size:20px ! important }',
  ].join('\n');
  const probe = countTokens(fixture);
  const selfTest = [
    probe.radiusLiteral === 3 && probe.offScale === 2 && probe.important === 2,
    compareToBaseline({ a: { radiusLiteral: 2, offScale: 0, important: 0 } }, { a: { radiusLiteral: 1, offScale: 0, important: 0 } }).length === 1,
    compareToBaseline({ a: { radiusLiteral: 1, offScale: 1, important: 3 } }, { a: { radiusLiteral: 1, offScale: 1, important: 4 } }).length === 0,
    compareToBaseline({ b: { radiusLiteral: 0, offScale: 0, important: 1 } }, {}).length === 1,
  ];
  if (selfTest.includes(false)) {
    console.error(`FAIL design-token ratchet self-test: ${JSON.stringify({ probe, selfTest })}`);
    process.exit(1);
  }
  const counts = measure();
  const total = totals(counts);
  const prior = existsSync(join(root, BASELINE_PATH)) ? JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8')) : null;
  if (process.argv.includes('--write')) {
    const growth = prior ? compareToBaseline(counts, prior.counts || {}) : [];
    if (growth.length && !process.argv.includes('--allow-growth')) {
      for (const line of growth) console.error(`REFUSED ${line}`);
      console.error('Refusing to record growth; --write records shrinks only.');
      process.exit(1);
    }
    writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({
      schemaVersion: 'aio-design-token-baseline.v1',
      generatedBy: relative(root, fileURLToPath(import.meta.url)),
      note: 'Per-stylesheet literal radius, off-scale font-size and !important counts. Shrink only; never raise a count or add a file.',
      totals: total,
      counts,
    }, null, 2)}\n`);
    console.log(`Design-token baseline written: ${Object.keys(counts).length} files, ${total.radiusLiteral} radius literals, ${total.offScale} off-scale sizes, ${total.important} !important.`);
  } else {
    if (!prior) {
      console.error(`FAIL ${BASELINE_PATH} missing — run with --write once.`);
      process.exit(1);
    }
    const failures = compareToBaseline(counts, prior.counts || {});
    if (failures.length) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exit(1);
    }
    const before = prior.totals || total;
    const shrank = KEYS.some((key) => total[key] < (before[key] ?? total[key]));
    console.log(`Design-token ratchet OK: ${total.radiusLiteral} radius literals, ${total.offScale} off-scale sizes, ${total.important} !important${shrank ? ' (shrank — run --write to lock in)' : ''}.`);
  }
}
