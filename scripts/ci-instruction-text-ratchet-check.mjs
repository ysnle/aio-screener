#!/usr/bin/env node
// scripts/ci-instruction-text-ratchet-check.mjs — v59.50 (recurrence audit 2026-10-31, R724)
//
// Counts per file the Korean string literals in src/ that read as a trading directive or a computed price level
// (scripts/lib/instruction-text-scan.mjs) and lets the count only shrink. The baseline holds the allowed cases: the AI
// prompt naming what it must not write, the user's own plan check (손절가 ${result.stop} is the number the user typed),
// and reading advice ("후보 목록으로 읽는 편이 맞습니다"). A new surface that tells the reader when to stage in, or prints
// close − ATR as a level, fails here instead of in a persona review.
//
// Usage:
//   node scripts/ci-instruction-text-ratchet-check.mjs           # verify
//   node scripts/ci-instruction-text-ratchet-check.mjs --write   # record shrinks (growth is refused)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instructionIssues } from './lib/instruction-text-scan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = 'architecture/instruction-text-baseline.json';

const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return walk(path);
  return /\.m?js$/.test(entry.name) ? [path] : [];
});

const selfTest = [
  ["const t = '분할 접근은 하이일드 스프레드 확대가 멈춘 뒤가 맞습니다.';", 1],
  ["const t = '나눠 보는 편이 맞습니다.';", 1],
  ["const t = '원인이 확인될 때까지 기다리는 쪽이 맞습니다.';", 1], // v59.51 content audit: missed by the v59.50 scanner
  ['const t = `종가에서 ATR 1배 아래는 ${price(close - levels.atr)}입니다.`;', 1],
  ['const t = `손절가 ${fmt(stop)}`;', 1],
  ["const t = '분할 접근의 비용은 스프레드가 안정되기 전에 큽니다.';", 0],
  ["const re = /매수하세요|손절하세요/;", 0],
  ['const t = `물가 목표 ${target}% 대비`;', 0],
].filter(([source, want]) => instructionIssues(source).length !== want);
if (selfTest.length) {
  console.error(`FAIL instruction-text scanner self-test: ${selfTest.map(([source, want]) => `${source} → ${instructionIssues(source).length}, want ${want}`).join('; ')}`);
  process.exit(1);
}

const counts = {};
const details = {};
for (const file of walk('src').sort()) {
  const issues = instructionIssues(readFileSync(join(root, file), 'utf8'));
  if (issues.length) { counts[file] = issues.length; details[file] = issues; }
}
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
const prior = existsSync(join(root, BASELINE_PATH)) ? JSON.parse(readFileSync(join(root, BASELINE_PATH), 'utf8')) : null;
const growth = Object.entries(counts).filter(([file, n]) => n > (prior?.counts?.[file] || 0))
  .map(([file, n]) => `${file}: directive or computed-price text grew ${prior?.counts?.[file] || 0} → ${n}: ${details[file].map((item) => `${item.kind} "${item.text}"`).join('; ')} — R724: describe what the cost depends on, map levels, never prescribe timing or print a computed stop/target`);

if (process.argv.includes('--write')) {
  if (prior && growth.length) {
    for (const line of growth) console.error(`REFUSED ${line}`);
    console.error('Refusing to record growth; --write records shrinks only.');
    process.exit(1);
  }
  writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify({
    schemaVersion: 'aio-instruction-text-baseline.v1',
    generatedBy: 'scripts/ci-instruction-text-ratchet-check.mjs',
    note: 'R724: per-file count of src/ string literals that read as a trading directive or a computed price level. The listed cases are allowed (AI prompt naming forbidden phrases, the user\'s own plan check, reading advice). Shrink only.',
    total,
    counts,
  }, null, 2)}\n`);
  console.log(`Instruction-text baseline written: ${total} allowed cases in ${Object.keys(counts).length} files.`);
} else {
  if (!prior) {
    console.error(`FAIL ${BASELINE_PATH} missing — run with --write once.`);
    process.exit(1);
  }
  if (growth.length) {
    for (const line of growth) console.error(`FAIL ${line}`);
    process.exit(1);
  }
  console.log(`Instruction-text ratchet OK: ${total} allowed cases${total < prior.total ? ` (shrank from ${prior.total} — run --write to lock in)` : ''}.`);
}
