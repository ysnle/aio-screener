#!/usr/bin/env node
// Recurring defect classes by principle (v59.59 docs restructure).
//
// BUG-POSTMORTEM.md holds ~1,500 P entries in one stream, so "which invariant keeps breaking" was not answerable
// without reading the ledger. This report maps each P entry to the RULES.md principles (C1~C18) it cites — directly
// (`C4`) or through an R id that lives under that principle's section — and counts entries per principle.
//
//   node scripts/ledger-class-report.mjs          print the table
//   node scripts/ledger-class-report.mjs --write  refresh the marked block at the top of BUG-POSTMORTEM.md
//
// Read-only except for the marked block; the P entries themselves are never touched, and record-fix keeps inserting
// new entries above the first `## P` heading, below this block. Entries that cite no R/C id (mostly pre-v52) are
// counted as unmapped rather than guessed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = '_context/RULES.md';
const POSTMORTEM = '_context/BUG-POSTMORTEM.md';
const BEGIN = '<!-- ledger-class-report:begin -->';
const END = '<!-- ledger-class-report:end -->';
const RECENT_FROM = 1900; // P1900 ≈ v57.9 (2026-10-17): the "recent" column covers the last ~300 entries.

export function principleMap(rulesText) {
  const names = {};
  const ruleToPrinciple = {};
  let current = null;
  for (const line of rulesText.split(/\r?\n/)) {
    const principle = line.match(/^## 원칙 (C\d+) — (.+)$/);
    if (principle) { [, current] = principle; names[current] = principle[2].trim(); continue; }
    const rule = line.match(/^## (R\d+)\./);
    if (rule && current) ruleToPrinciple[rule[1]] = current;
    // An inbox rule sits above the principle sections; its principle's 정본 line names it ("수신함: R734").
    const inbox = current && /^\*\*정본\*\*/.test(line) ? line.match(/수신함:\s*((?:R\d+(?:,\s*)?)+)/) : null;
    if (inbox) for (const id of inbox[1].split(/,\s*/)) ruleToPrinciple[id] = current;
  }
  return { names, ruleToPrinciple };
}

export function classify(postmortemText, { names, ruleToPrinciple }) {
  const blocks = postmortemText.split(/\r?\n(?=#{2,3} P\d+\b)/).filter((block) => /^#{2,3} P\d+\b/.test(block));
  const stats = Object.fromEntries(Object.keys(names).map((id) => [id, { total: 0, recent: 0, latest: [] }]));
  let unmapped = 0;
  for (const block of blocks) {
    const pid = Number(block.match(/P(\d+)/)[1]);
    const viaRules = [...block.matchAll(/\bR(\d{1,3})\b/g)].map((m) => ruleToPrinciple[`R${m[1]}`]);
    const direct = [...block.matchAll(/\b(C\d{1,2})\b/g)].map((m) => m[1]);
    const principles = [...new Set([...viaRules, ...direct].filter((id) => id && names[id]))];
    if (!principles.length) { unmapped += 1; continue; }
    for (const id of principles) {
      const entry = stats[id];
      entry.total += 1;
      if (pid >= RECENT_FROM) entry.recent += 1;
      if (entry.latest.length < 3) entry.latest.push(`P${pid}`);
    }
  }
  return { total: blocks.length, unmapped, stats };
}

export function renderTable({ total, unmapped, stats }, names, date) {
  const order = Object.keys(names).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const rows = order.map((id) => `| ${id} ${names[id]} | ${stats[id].total} | ${stats[id].recent} | ${stats[id].latest.join(', ') || '—'} |`);
  return [
    `집계 ${date}: P 항목 ${total}건 중 원칙에 연결된 ${total - unmapped}건, 연결 없음 ${unmapped}건(대부분 v52 이전, R/C 인용 없음). 한 항목이 여러 원칙을 인용하면 각 원칙에 센다. 최근 = P${RECENT_FROM} 이후. 재생성: \`node scripts/ledger-class-report.mjs --write\`.`,
    '',
    '| 원칙 (RULES.md) | P 항목 | 최근 | 최신 사례 |',
    '|---|---:|---:|---|',
    ...rows,
  ].join('\n');
}

function main() {
  const map = principleMap(readFileSync(join(root, RULES), 'utf8'));
  const postmortem = readFileSync(join(root, POSTMORTEM), 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  const table = renderTable(classify(postmortem, map), map.names, date);
  if (!process.argv.includes('--write')) { console.log(table); return; }
  const start = postmortem.indexOf(BEGIN);
  const stop = postmortem.indexOf(END);
  if (start < 0 || stop < start) throw new Error(`${POSTMORTEM}: marker block ${BEGIN} … ${END} not found`);
  const next = `${postmortem.slice(0, start + BEGIN.length)}\n${table}\n${postmortem.slice(stop)}`;
  writeFileSync(join(root, POSTMORTEM), next, 'utf8');
  console.log(`[ledger-class-report] refreshed ${POSTMORTEM} class table`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
