#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ci-ledger-integrity-check.mjs — P1123/R618
//
// The ledgers (RULES/QA-CHECKLIST) are only a self-improvement loop if their
// shape is machine-checked. Two things were silently drifting:
//
//   1. R number gaps. RULES.md declares "R번호는 전량 보존" but 65 numbers are
//      absent entirely. Nothing recorded which, so an accidental skip looked
//      identical to a deliberate retirement.
//   2. Open QA items had no re-verification trigger. An item recorded as
//      "resolved by the next refresh" stayed open for cycles because nothing
//      said who/what would re-check it (P1117 was exactly this: a producer bug
//      mislabelled as a wait state).
//
// Usage:
//   node scripts/ci-ledger-integrity-check.mjs            # verify
//   node scripts/ci-ledger-integrity-check.mjs --write    # regenerate baselines
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const hash = (value) => createHash('sha1').update(String(value)).digest('hex').slice(0, 12);

const RULE_GAP_PATH = '_context/rule-gap-manifest.json';
const OPEN_BASELINE_PATH = '_context/open-item-baseline.json';

const errors = [];
const check = (label, ok, detail = '') => { if (!ok) errors.push(detail ? `${label}: ${detail}` : label); };

// ── 1. R number gaps are an explicit, frozen set ────────────────────────────
const rulesText = read('_context/RULES.md');
const defined = new Set([...rulesText.matchAll(/^## R(\d+)\./gm)].map((match) => Number(match[1])));
if (!defined.size) errors.push('RULES.md declares no R headings; the ledger parser is broken or the file moved');
const maxR = Math.max(...defined);
const actualGaps = [];
for (let n = 1; n <= maxR; n += 1) if (!defined.has(n)) actualGaps.push(n);

if (write) {
  writeFileSync(join(root, RULE_GAP_PATH), `${JSON.stringify({
    schemaVersion: 'aio-rule-gap-manifest.v1',
    generatedBy: 'scripts/ci-ledger-integrity-check.mjs',
    note: 'R numbers absent from _context/RULES.md. This set is frozen: a new gap means a rule was deleted or skipped and must be explained in RULES.md, not absorbed here.',
    maxR,
    definedCount: defined.size,
    absentCount: actualGaps.length,
    absentR: actualGaps,
  }, null, 2)}\n`, 'utf8');
  console.log(`[ledger-integrity] wrote ${RULE_GAP_PATH} (${actualGaps.length} absent R numbers)`);
} else {
  if (!existsSync(join(root, RULE_GAP_PATH))) {
    errors.push(`${RULE_GAP_PATH} missing — run with --write to record the current gap set`);
  } else {
    const manifest = JSON.parse(read(RULE_GAP_PATH));
    const recorded = new Set(manifest.absentR || []);
    const newGaps = actualGaps.filter((n) => !recorded.has(n));
    const healed = [...recorded].filter((n) => !actualGaps.includes(n));
    check('P1123/R618 R number gaps match the frozen manifest (no rule may vanish silently)', newGaps.length === 0, `new gaps: ${newGaps.join(', ')}`);
    if (healed.length) {
      console.log(`[ledger-integrity] note: ${healed.length} previously absent R number(s) are now defined (${healed.slice(0, 10).join(', ')}${healed.length > 10 ? ', …' : ''}) — rerun with --write to shrink the manifest`);
    }
    check('P1123/R618 R gap manifest stays consistent with the defined rule count', manifest.definedCount == null || defined.size >= manifest.definedCount * 0.9, `defined now ${defined.size}, manifest recorded ${manifest.definedCount}`);
  }
}

// ── 2. Open QA items declare how they will be re-verified ───────────────────
const qaText = read('_context/QA-CHECKLIST.md');
const openItems = qaText.split(/\r?\n/).filter((line) => /^- \[ \]/.test(line));
const withoutTrigger = openItems.filter((line) => !/verify_by:\s*\S+/.test(line)).map((line) => hash(line.trim()));

if (write) {
  writeFileSync(join(root, OPEN_BASELINE_PATH), `${JSON.stringify({
    schemaVersion: 'aio-open-item-baseline.v1',
    generatedBy: 'scripts/ci-ledger-integrity-check.mjs',
    note: 'Open QA items that predate the verify_by convention. New open items must end with "verify_by: <gate-or-trigger>" so a future session can re-check them instead of re-deciding.',
    openCount: openItems.length,
    withoutVerifyBy: withoutTrigger.sort(),
  }, null, 2)}\n`, 'utf8');
  console.log(`[ledger-integrity] wrote ${OPEN_BASELINE_PATH} (${withoutTrigger.length}/${openItems.length} open items lack verify_by)`);
} else {
  if (!existsSync(join(root, OPEN_BASELINE_PATH))) {
    errors.push(`${OPEN_BASELINE_PATH} missing — run with --write to record the current debt`);
  } else {
    const baseline = JSON.parse(read(OPEN_BASELINE_PATH));
    const known = new Set(baseline.withoutVerifyBy || []);
    const untracked = withoutTrigger.filter((id) => !known.has(id));
    check('P1123/R618 new open QA items declare verify_by', untracked.length === 0, `${untracked.length} untracked open item(s); add "verify_by: <gate>" or rerun --write after an authorised bulk change`);
    check('P1123/R618 open QA item debt is reported, not hidden', Array.isArray(baseline.withoutVerifyBy), 'baseline is malformed');
    console.log(`[ledger-integrity] QA open items: ${openItems.length} | without verify_by: ${withoutTrigger.length} (baseline ${(baseline.withoutVerifyBy || []).length}) | RULES R${maxR}, gaps ${actualGaps.length}`);
  }
}

if (errors.length) {
  console.error('Ledger integrity check failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
if (!write) {
  console.log('Ledger integrity OK: R gap set is frozen and every new open QA item must declare how it will be re-verified.');
}
