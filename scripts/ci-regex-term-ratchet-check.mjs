#!/usr/bin/env node
// scripts/ci-regex-term-ratchet-check.mjs — v59.50 (recurrence audit 2026-10-31)
//
// Keyword regexes that can match inside a longer word (scripts/lib/regex-term-scan.mjs) are counted per file and may
// only shrink. The class recurred 18 times (P1503 … P2131, P2146, P2164) because each fix bounded one list. New lists
// write \b(?:FED|CPI)\b, (?<![A-Za-z])AI(?![A-Za-z]), (?<![가-힣])이란 or 유가(?!증권) instead of a bare term.
//
// Usage:
//   node scripts/ci-regex-term-ratchet-check.mjs           # verify
//   node scripts/ci-regex-term-ratchet-check.mjs --write   # record shrinks (growth is refused)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSource, unboundedTerms } from './lib/regex-term-scan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = 'architecture/regex-term-baseline.json';
const SCOPES = ['src', 'scripts/lib', 'scripts/producer'];

const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return walk(path);
  return /\.m?js$/.test(entry.name) ? [path] : [];
});

function measure() {
  const counts = {};
  for (const file of SCOPES.flatMap(walk).sort()) {
    if (file === 'scripts/lib/regex-term-scan.mjs') continue;
    const terms = scanSource(readFileSync(join(root, file), 'utf8'));
    if (terms.length) counts[file] = terms.length;
  }
  return counts;
}

export function compareToBaseline(counts, baseline) {
  return Object.entries(counts)
    .filter(([file, n]) => n > (baseline[file] || 0))
    .map(([file, n]) => `${file}: unbounded keyword terms grew ${baseline[file] || 0} → ${n} (${scanSource(readFileSync(join(root, file), 'utf8')).join(', ')}) — bound each with \\b, a lookaround or (?<![가-힣])`);
}

const selfTest = [
  ['PIK|부도|BDC', ['PIK', 'BDC']], // P2146: 'sPIKe'
  [String.raw`\b(?:PIK|BDCs?)\b|부도`, []],
  ['호르무즈|이란|유가|crude', ['이란', '유가', 'crude']], // P2146: '시즌이란', '유가증권'
  [String.raw`(?<![가-힣])이란|유가(?!증권)|\bcrude\b`, []],
  ['(부담|안정|양호)', ['안정']], // P2164: '불안정'
  [String.raw`^(?:ok|fresh|live)$`, []],
  ['analy(?:st|sis)|report(?:s|ed)', []],
].filter(([source, want]) => JSON.stringify(unboundedTerms(source)) !== JSON.stringify(want));
if (selfTest.length) {
  console.error(`FAIL regex-term scanner self-test: ${selfTest.map(([source, want]) => `${source} → ${JSON.stringify(unboundedTerms(source))}, want ${JSON.stringify(want)}`).join('; ')}`);
  process.exit(1);
}

const counts = measure();
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
const prior = existsSync(join(root, BASELINE_PATH)) ? JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8')) : null;
if (process.argv.includes('--write')) {
  const growth = prior ? compareToBaseline(counts, prior.counts || {}) : [];
  if (growth.length) {
    for (const line of growth) console.error(`REFUSED ${line}`);
    console.error('Refusing to record growth; --write records shrinks only.');
    process.exit(1);
  }
  writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({
    schemaVersion: 'aio-regex-term-baseline.v1',
    generatedBy: 'scripts/ci-regex-term-ratchet-check.mjs',
    note: 'Per-file count of keyword-regex alternatives that can match inside a longer word (short Latin terms without a boundary, Korean trap words without a lookaround). Shrink only.',
    scopes: SCOPES,
    total,
    counts,
  }, null, 2)}\n`);
  console.log(`Regex-term baseline written: ${total} unbounded terms in ${Object.keys(counts).length} files.`);
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
  console.log(`Regex-term ratchet OK: ${total} unbounded terms${total < prior.total ? ` (shrank from ${prior.total} — run --write to lock in)` : ''}.`);
}
