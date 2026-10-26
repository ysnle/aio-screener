#!/usr/bin/env node
// scripts/ci-text-pin-ratchet-check.mjs — v57.54
//
// Many CI gates read product source (src/, js/, index.html) as text and pin copy or code shape with
// `.includes('…')` or a regex literal `.test(…)`. Those checks break on harmless rewording and pass on
// broken behaviour, so they are frozen here per file: the count may shrink (convert a pin into a
// behaviour test that imports the module and checks its output) but may not grow, and a gate that does
// not read source today may not start pinning it. A line that genuinely needs a text check can carry
// `// text-pin-ok: <reason>` and is not counted.
//
// Usage:
//   node scripts/ci-text-pin-ratchet-check.mjs           # verify
//   node scripts/ci-text-pin-ratchet-check.mjs --write   # regenerate the baseline (only to record a shrink)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const BASELINE_PATH = '_context/text-pin-baseline.json';

// Product source is a src/ or js/ path or index.html named in a string literal.
const SOURCE_PATH = String.raw`['"\x60](?:\.\/)?(?:src\/|js\/|index\.html['"\x60])`;
const READS_SOURCE = new RegExp(SOURCE_PATH);
// `const x = read('src/…')`, `readFileSync(join(root, 'js/…'), 'utf8')` and similar text reads.
const SOURCE_VAR = new RegExp(String.raw`(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*?\bread\w*\([^;\n]*?` + SOURCE_PATH, 'g');
const escapeRe = (value) => value.replace(/[$]/g, '\\$');

// Only checks on source text count; `.includes()` on a function's output is a behaviour test and stays free.
export function countTextPins(source) {
  const text = String(source);
  // v58.86: a consolidated gate (scripts/lib/gate-sections.mjs) scopes each former gate's variables to its own section, so
  // a source variable is resolved inside its section only.
  const sections = text.split(/^\/\/ ── section /m);
  if (sections.length > 1) return sections.reduce((sum, section) => sum + countTextPins(section), 0);
  const vars = [...new Set([...text.matchAll(SOURCE_VAR)].map((match) => escapeRe(match[1])))];
  const receivers = [String.raw`\bread\w*\([^()\n]*?` + SOURCE_PATH + String.raw`[^()\n]*\)`, ...vars.map((v) => String.raw`\b${v}\b`)];
  const pins = receivers.flatMap((receiver) => [
    new RegExp(String.raw`${receiver}\s*\.includes\(\s*['"\x60]`, 'g'),
    new RegExp(String.raw`\/(?:[^/\n\\]|\\.)+\/[a-z]*\.test\(\s*${receiver}`, 'g'),
    new RegExp(String.raw`${receiver}\s*\.match\(\s*\/`, 'g'),
  ]);
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/text-pin-ok:/.test(line)) continue;
    for (const re of pins) count += (line.match(re) || []).length;
  }
  return count;
}

export function compareToBaseline(counts, baseline) {
  const failures = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file];
    if (allowed === undefined) {
      if (count > 0) failures.push(`${file}: new gate pins product source text (${count} checks) — test behaviour instead`);
    } else if (count > allowed) {
      failures.push(`${file}: text pins grew ${allowed} → ${count} — test behaviour instead, or mark a necessary line text-pin-ok`);
    }
  }
  return failures;
}

// v57.84: the `text-pin-ok` escape was itself unbounded — marking a line was a free way past the ratchet. The number
// of marked lines is frozen too, and --write no longer records growth unless --allow-growth says so on purpose.
function countExemptions() {
  let n = 0;
  for (const name of readdirSync(join(root, 'scripts')).filter((f) => /^ci-.*\.mjs$/.test(f))) {
    if (name === 'ci-text-pin-ratchet-check.mjs') continue;
    n += (readFileSync(join(root, 'scripts', name), 'utf8').match(/text-pin-ok:/g) || []).length;
  }
  return n;
}

function measure() {
  const counts = {};
  for (const name of readdirSync(join(root, 'scripts')).filter((n) => /^ci-.*\.mjs$/.test(n)).sort()) {
    if (name === 'ci-text-pin-ratchet-check.mjs') continue;
    const source = readFileSync(join(root, 'scripts', name), 'utf8');
    if (!READS_SOURCE.test(source)) continue;
    const pins = countTextPins(source);
    if (pins) counts[`scripts/${name}`] = pins;
  }
  return counts;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // Self-test (v57.54): source pins count, output checks and marked lines do not, growth and new files fail.
  const fixture = [
    "const page = read('src/ui/pages/home.js');",
    "check('v57.54 copy', page.includes('지금'));",
    "check('v57.54 shape', /export function/.test(page));",
    "check('v57.54 output', render().includes('지금'));",
    "check('v57.54 needed', page.includes('x')); // text-pin-ok: fixture",
  ].join('\n');
  const selfTest = [
    countTextPins(fixture) === 2,
    compareToBaseline({ a: 3 }, { a: 2 }).length === 1,
    compareToBaseline({ a: 1 }, { a: 2 }).length === 0,
    compareToBaseline({ b: 1 }, {}).length === 1,
  ];
  if (selfTest.includes(false)) {
    console.error(`FAIL text-pin ratchet self-test: ${JSON.stringify(selfTest)}`);
    process.exit(1);
  }
  const counts = measure();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const exemptLines = countExemptions();
  const prior = existsSync(join(root, BASELINE_PATH)) ? JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8')) : null;
  const exemptAllowed = Number.isFinite(prior?.exemptLines) ? prior.exemptLines : null;
  if (write && prior && !process.argv.includes('--allow-growth')) {
    const growth = compareToBaseline(counts, prior.counts || {});
    if (exemptAllowed != null && exemptLines > exemptAllowed) growth.push(`text-pin-ok lines grew ${exemptAllowed} → ${exemptLines}`);
    if (growth.length) {
      for (const g of growth) console.error(`REFUSED ${g}`);
      console.error('Refusing to record growth; --write records shrinks only (use --allow-growth for a justified raise).');
      process.exit(1);
    }
  }
  if (write) {
    writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({
      schemaVersion: 'aio-text-pin-baseline.v1',
      generatedBy: 'scripts/ci-text-pin-ratchet-check.mjs',
      note: 'Per-gate count of product-source text pins. Shrink only; never raise a count or add a file.',
      files: Object.keys(counts).length,
      totalPins: total,
      exemptLines,
      counts,
    }, null, 2)}\n`);
    console.log(`Text-pin baseline written: ${Object.keys(counts).length} files, ${total} pins.`);
  } else {
    if (!existsSync(join(root, BASELINE_PATH))) {
      console.error(`FAIL ${BASELINE_PATH} missing — run with --write once.`);
      process.exit(1);
    }
    const baseline = prior.counts || {};
    const failures = compareToBaseline(counts, baseline);
    if (exemptAllowed == null) failures.push(`${BASELINE_PATH} has no exemptLines record — run with --write`);
    else if (exemptLines > exemptAllowed) failures.push(`text-pin-ok lines grew ${exemptAllowed} → ${exemptLines} — the escape is frozen like the pins`);
    const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] || 0) < n).length;
    if (failures.length) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exit(1);
    }
    console.log(`Text-pin ratchet OK: ${Object.keys(counts).length} files, ${total} pins${shrunk ? ` (${shrunk} files shrank — run --write to lock in)` : ''}.`);
  }
}
