#!/usr/bin/env node
// scripts/ci-inline-style-ratchet-check.mjs — 2026-10-19 layout system
//
// Pages styled themselves through inline style="" attributes and `.style.cssText` strings (1,193 in index.html,
// 838 in js/ templates, 213 cssText in src/): hard-coded pixel values that ignore the :root scale, a dark theme
// that misses them, and 10-11px text that index.html's substring `[style*="font-size:10px"]` !important rules had to
// raise to 12px after the fact. Two counts per file are frozen here; they may shrink, never grow:
//   inline       — style="…" / style='…' attributes, `.style.cssText =` and setAttribute('style', …)
//   belowFloor   — any `font-size: Npx` with N < 12 (the --fs-min floor), inline or in a CSS rule
// New styling goes in a class (src/ui/styles/*.css, tokens from index.html :root and layout-primitives.css).
// Setting one computed property (`node.style.left = …` for a measured position) is not counted.
//
// Usage:
//   node scripts/ci-inline-style-ratchet-check.mjs           # verify
//   node scripts/ci-inline-style-ratchet-check.mjs --write   # record shrinks (growth is refused)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = '_context/inline-style-baseline.json';
const FLOOR_PX = 12;

const INLINE_RE = /\bstyle\s*=\s*\\?["'`]|\.style\.cssText\s*[+]?=|setAttribute\(\s*['"]style['"]/g;
const FONT_RE = /font-size\s*:\s*(\d+(?:\.\d+)?)px/g;

export function countStyles(source) {
  const text = String(source);
  const inline = (text.match(INLINE_RE) || []).length;
  let belowFloor = 0;
  for (const match of text.matchAll(FONT_RE)) if (Number(match[1]) < FLOOR_PX) belowFloor += 1;
  return { inline, belowFloor };
}

// The test harness files (js/aio-tests.js, js/aio-qa-audits.js) build fixtures, not pages.
const SKIP = new Set(['js/aio-tests.js', 'js/aio-qa-audits.js']);
function productFiles() {
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    return /\.(?:js|css)$/.test(entry.name) ? [path] : [];
  });
  return ['index.html', ...walk('js'), ...walk('src')].filter((file) => !SKIP.has(file)).sort();
}

function measure() {
  const counts = {};
  for (const file of productFiles()) {
    const result = countStyles(readFileSync(join(root, file), 'utf8'));
    if (result.inline || result.belowFloor) counts[file] = result;
  }
  return counts;
}

export function compareToBaseline(counts, baseline) {
  const failures = [];
  for (const [file, now] of Object.entries(counts)) {
    const allowed = baseline[file] || { inline: 0, belowFloor: 0 };
    if (now.inline > allowed.inline) failures.push(`${file}: inline styles grew ${allowed.inline} → ${now.inline} — use a class (src/ui/styles, layout-primitives.css)`);
    if (now.belowFloor > allowed.belowFloor) failures.push(`${file}: font sizes below ${FLOOR_PX}px grew ${allowed.belowFloor} → ${now.belowFloor} — the floor is var(--fs-min)`);
  }
  return failures;
}

const totals = (counts) => Object.values(counts).reduce((sum, item) => ({ inline: sum.inline + item.inline, belowFloor: sum.belowFloor + item.belowFloor }), { inline: 0, belowFloor: 0 });

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const fixture = [
    "node.style.cssText = 'font-size:10px;color:red';",
    "html += '<span style=\"font-size: 11.5px\">x</span>';",
    "node.style.left = `${x}px`;",
    ".a { font-size: 12px; } .b { font-size:9px }",
  ].join('\n');
  const probe = countStyles(fixture);
  const selfTest = [
    probe.inline === 2 && probe.belowFloor === 3,
    compareToBaseline({ a: { inline: 3, belowFloor: 0 } }, { a: { inline: 2, belowFloor: 0 } }).length === 1,
    compareToBaseline({ a: { inline: 1, belowFloor: 1 } }, { a: { inline: 2, belowFloor: 1 } }).length === 0,
    compareToBaseline({ b: { inline: 0, belowFloor: 1 } }, {}).length === 1,
  ];
  if (selfTest.includes(false)) {
    console.error(`FAIL inline-style ratchet self-test: ${JSON.stringify(selfTest)}`);
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
      schemaVersion: 'aio-inline-style-baseline.v1',
      generatedBy: relative(root, fileURLToPath(import.meta.url)),
      note: 'Per-file inline style and sub-12px font-size counts. Shrink only; never raise a count or add a file.',
      totals: total,
      counts,
    }, null, 2)}\n`);
    console.log(`Inline-style baseline written: ${Object.keys(counts).length} files, ${total.inline} inline, ${total.belowFloor} below ${FLOOR_PX}px.`);
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
    const before = prior.totals || { inline: 0, belowFloor: 0 };
    const shrank = total.inline < before.inline || total.belowFloor < before.belowFloor;
    console.log(`Inline-style ratchet OK: ${total.inline} inline, ${total.belowFloor} below ${FLOOR_PX}px${shrank ? ` (shrank from ${before.inline}/${before.belowFloor} — run --write to lock in)` : ''}.`);
  }
}
