#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ci-assertion-trace-check.mjs — P1124/R618
//
// AIO carries ~1,378 `check()` calls in scripts/ci-*.mjs and ~1,185 `_assert()`
// calls in js/aio-tests.js. That volume is only defensible if each assertion can
// be traced to the failure it prevents. Today most cannot: the ledger records
// "prevention: <gate>" but the gate does not name the postmortem/rule it serves,
// so the loop runs one way (ledger → code) and never back (code → ledger).
//
// This gate makes the link mandatory for NEW assertions without rewriting the
// existing ones: anything not in the frozen baseline must cite a ledger id.
//
// Usage:
//   node scripts/ci-assertion-trace-check.mjs            # verify
//   node scripts/ci-assertion-trace-check.mjs --write    # regenerate baseline
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const hash = (value) => createHash('sha1').update(String(value)).digest('hex').slice(0, 12);

const BASELINE_PATH = '_context/assertion-trace-baseline.json';

// A label "cites a ledger id" when it names the entry it prevents a regression of.
// Postmortems (P####), rules (R###), QA entries (QA-EXHAUST-##), the T### headless
// ids and the named workstream ids (WP-AI0, AIQ-4, H3-D, EF-13, LIVE3-01 …) all count.
const EVIDENCE = /(?:^|[^A-Za-z0-9])(?:R\d{2,4}|P\d{3,4}|QA-[A-Z0-9-]+|T\d{3,5}|WP-AI\d+|WP-\d+|AIQ-[A-Z0-9-]+|RM-\d+|EF-\d+|H[23]-[A-Z0-9]+|LIVE3-\d+|W\d-\d+|SA-?\d{2}|PFE2-\d+|AR-\d+|S\d)(?![0-9])/;

const LABEL_RE = /\b(?:check|_assert)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g;

function collectLabels(source) {
  const labels = [];
  LABEL_RE.lastIndex = 0;
  let match;
  while ((match = LABEL_RE.exec(source))) {
    const label = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (label) labels.push(label);
  }
  return labels;
}

const targets = [
  ...readdirSync(join(root, 'scripts')).filter((name) => /^ci-.*\.mjs$/.test(name)).sort().map((name) => `scripts/${name}`),
  'js/aio-tests.js',
];

// P1545: format-only evidence let a fabricated "P9999" pass. A cited P####/R### id must resolve to a ledger
// entry (any mention in _context/*.md or CHANGELOG.md). Labels that also cite a non-ledger id (T###, QA-…,
// workstream ids) keep that evidence, so only labels whose sole evidence is an unresolvable P/R id fail.
const ledgerText = [
  ...readdirSync(join(root, '_context')).filter((name) => name.endsWith('.md')).map((name) => `_context/${name}`),
  'CHANGELOG.md',
].filter((rel) => existsSync(join(root, rel))).map(read).join('\n');
const ledgerHas = (id) => new RegExp(`(?:^|[^A-Za-z0-9])${id}(?![0-9])`).test(ledgerText);
const LEDGER_ID = /(?:^|[^A-Za-z0-9])([PR]\d{2,4})(?![0-9])/g;
const OTHER_EVIDENCE = /(?:^|[^A-Za-z0-9])(?:QA-[A-Z0-9-]+|T\d{3,5}|WP-AI\d+|WP-\d+|AIQ-[A-Z0-9-]+|RM-\d+|EF-\d+|H[23]-[A-Z0-9]+|LIVE3-\d+|W\d-\d+|SA-?\d{2}|PFE2-\d+|AR-\d+|S\d)(?![0-9])/;
function unresolvedLedgerOnly(label) {
  const ids = [...label.matchAll(LEDGER_ID)].map((match) => match[1]);
  if (!ids.length || ids.some(ledgerHas) || OTHER_EVIDENCE.test(label)) return null;
  return ids;
}

const unlabeled = {};
const dangling = [];
let total = 0;
let unlabeledTotal = 0;
for (const file of targets) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const labels = collectLabels(read(file));
  total += labels.length;
  const missing = labels.filter((label) => !EVIDENCE.test(label));
  unlabeledTotal += missing.length;
  if (missing.length) unlabeled[file] = missing.map(hash).sort();
  for (const label of labels) {
    const ids = unresolvedLedgerOnly(label);
    if (ids) dangling.push(`${file}: ${ids.join('/')} — ${label.slice(0, 90)}`);
  }
}

if (write) {
  writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({
    schemaVersion: 'aio-assertion-trace-baseline.v1',
    generatedBy: 'scripts/ci-assertion-trace-check.mjs',
    note: 'Assertions that predate the ledger-trace convention, keyed by sha1(label)[0:12]. Only NEW or RENAMED labels must cite an R/P/QA/T evidence id. Shrink this file as labels are annotated; never grow it without an authorised bulk change.',
    checkedFiles: targets.length,
    totalLabels: total,
    unlabeledLabels: unlabeledTotal,
    unlabeled,
  }, null, 2)}\n`, 'utf8');
  console.log(`[assertion-trace] wrote ${BASELINE_PATH}: ${unlabeledTotal}/${total} labels lack a ledger id`);
  process.exit(0);
}

if (!existsSync(join(root, BASELINE_PATH))) {
  console.error(`Assertion trace check failed:\n - ${BASELINE_PATH} missing — run with --write to record the current debt`);
  process.exit(1);
}

const baseline = JSON.parse(read(BASELINE_PATH));
const known = baseline.unlabeled || {};
const untraced = [];
for (const [file, hashes] of Object.entries(unlabeled)) {
  const allowed = new Set(known[file] || []);
  for (const id of hashes) if (!allowed.has(id)) untraced.push(`${file}#${id}`);
}

if (dangling.length) {
  console.error('Assertion trace check failed:');
  console.error(` - ${dangling.length} assertion label(s) cite a P/R id that no ledger entry contains (P1545):`);
  for (const entry of dangling.slice(0, 20)) console.error(`   ${entry}`);
  process.exit(1);
}

if (untraced.length) {
  console.error('Assertion trace check failed:');
  console.error(` - ${untraced.length} new assertion label(s) do not cite a ledger id (R###/P####/QA-/T###):`);
  for (const entry of untraced.slice(0, 20)) console.error(`   ${entry}`);
  console.error('   Add the id the assertion prevents a regression of, or rerun with --write after an authorised bulk change.');
  process.exit(1);
}

console.log(`Assertion trace OK: ${total} labelled assertions, ${unlabeledTotal} grandfathered (baseline ${baseline.unlabeledLabels ?? 'n/a'}), 0 new untraced.`);
