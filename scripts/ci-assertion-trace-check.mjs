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
// existing ones: anything not in the frozen baseline must cite a ledger id, or (v57.54)
// for non-defect work the release that introduced it (vNN.NN with a CHANGELOG heading).
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
// v57.54: non-defect assertions (features, cleanups, refactors) have no postmortem to cite and were being pushed
// into the defect ledger just to satisfy this gate. They may instead cite the release that introduced them —
// a "v57.54"-style token that resolves to an existing "## v57.54" CHANGELOG.md heading. Some evidence is still
// mandatory, and a release that has no CHANGELOG heading is not evidence.
const changelogPath = join(root, 'CHANGELOG.md');
const releaseHeadings = new Set(existsSync(changelogPath)
  ? [...read('CHANGELOG.md').matchAll(/^##\s+(v\d{1,3}(?:\.\d{1,2})?)(?![0-9.])/gm)].map((match) => match[1])
  : []);
const RELEASE_ID = /(?:^|[^A-Za-z0-9.])(v\d{1,3}\.\d{1,2})(?![0-9.])/g;
const citesRelease = (label) => [...label.matchAll(RELEASE_ID)].some((match) => releaseHeadings.has(match[1]));
const hasEvidence = (label) => EVIDENCE.test(label) || citesRelease(label);
const ledgerHas = (id) => new RegExp(`(?:^|[^A-Za-z0-9])${id}(?![0-9])`).test(ledgerText);
const LEDGER_ID = /(?:^|[^A-Za-z0-9])([PR]\d{2,4})(?![0-9])/g;
const OTHER_EVIDENCE = /(?:^|[^A-Za-z0-9])(?:QA-[A-Z0-9-]+|T\d{3,5}|WP-AI\d+|WP-\d+|AIQ-[A-Z0-9-]+|RM-\d+|EF-\d+|H[23]-[A-Z0-9]+|LIVE3-\d+|W\d-\d+|SA-?\d{2}|PFE2-\d+|AR-\d+|S\d)(?![0-9])/;
function unresolvedLedgerOnly(label) {
  const ids = [...label.matchAll(LEDGER_ID)].map((match) => match[1]);
  if (!ids.length || ids.some(ledgerHas) || OTHER_EVIDENCE.test(label) || citesRelease(label)) return null;
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
  const missing = labels.filter((label) => !hasEvidence(label));
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
  console.error(` - ${untraced.length} new assertion label(s) cite no evidence (R###/P####/QA-/T### ledger id, or a vNN.NN release with a CHANGELOG heading):`);
  for (const entry of untraced.slice(0, 20)) console.error(`   ${entry}`);
  console.error('   Cite the P/R id the assertion prevents a regression of; for a feature or cleanup, cite the release that introduced it (e.g. "v57.54 ..."). Rerun with --write only after an authorised bulk change.');
  process.exit(1);
}

console.log(`Assertion trace OK: ${total} labelled assertions, ${unlabeledTotal} grandfathered (baseline ${baseline.unlabeledLabels ?? 'n/a'}), 0 new untraced.`);
