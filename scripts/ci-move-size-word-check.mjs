#!/usr/bin/env node
// v60.19 (one materiality vocabulary): a size word (급등 · 급락 · 큰 폭 · 소폭 · 보합권 · 크게 오르다 …) is the move-size
// grade of src/domain/market/session/move-size.js — the move against the series' own volatility on the market-day
// ledger's tiers (RULES.moveMateriality). This gate scans every runtime and producer-library source for a size word that
// a fixed number selects: a string holding the word in the branch of a comparison against a non-zero number or a named
// threshold (`x >= 5 ? '크게 …'`, `Math.abs(x) < RULES.fx.krwFlatPct ? '보합권'`). A sign test (`x < 0 ? '급락' : '급등'`)
// is the same fixed choice when it is the only thing that picks the word, so it fails too. A rule name that prints its own
// line (a criterion list, a condition label) holds no comparison and passes; a sentence that compares against a policy
// line names the line instead of a size word.
//   node scripts/ci-move-size-word-check.mjs [--files a.js,b.mjs] [--self-test]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE_WORD = /급등|급락|폭등|폭락|급반등|급강세|큰 폭|소폭|보합권|크게 ?(?:오르|올랐|올라|내리|내렸|내려|떨어|빠지|빠졌|빠져|밀려|밀렸|움직|늘|줄|뛰|하락|상승)/;
// A comparison whose right side is a non-zero number or a named constant (A.b, RULES.x.y, either sign).
const NUMBER = String.raw`-?(?:\d*\.\d+|[1-9]\d*(?:\.\d+)?)`;
const NAMED = String.raw`-?[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$.]*`;
const FIXED_COMPARE = new RegExp(String.raw`(?:[<>]=?)\s*(?:${NUMBER}|${NAMED})(?![\w$(])`);
const SIGN_COMPARE = /[\w$.)\]]\s*(?:<|>)=?\s*0(?![\w.])/;

/** The (condition, branch) pairs of each ternary on a line: the text before `?` back to the previous `?`/`:`/`(`/`,`. */
function ternaries(line) {
  const out = [];
  let depth = 0; let quote = null;
  const marks = [];
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) { if (ch === '\\') { i += 1; continue; } if (ch === quote) quote = null; else if (quote === '`' && ch === '$' && line[i + 1] === '{') { depth += 1; marks.push({ i, kind: 'open' }); quote = null; i += 1; } continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '}' && depth > 0) { depth -= 1; quote = '`'; marks.push({ i, kind: 'close' }); continue; }
    if (ch === '?' && line[i + 1] !== '.' && line[i + 1] !== '?' && line[i - 1] !== '?') marks.push({ i, kind: '?' });
    if (ch === ':' ) marks.push({ i, kind: ':' });
  }
  const qs = marks.filter((mark) => mark.kind === '?');
  for (const q of qs) {
    const before = marks.filter((mark) => mark.i < q.i && mark.kind !== '?' ? true : mark.i < q.i && mark.kind === '?').at(-1);
    const start = before ? before.i + 1 : 0;
    const next = marks.find((mark) => mark.i > q.i && (mark.kind === ':' || mark.kind === '?'));
    const branchEnd = next ? next.i : line.length;
    const after = marks.find((mark) => mark.i > branchEnd && (mark.kind === ':' || mark.kind === '?' || mark.kind === 'close'));
    out.push({ condition: line.slice(start, q.i), yes: line.slice(q.i + 1, branchEnd), no: next?.kind === ':' ? line.slice(branchEnd + 1, after ? after.i : line.length) : '' });
  }
  return out;
}

/** Findings in one source text: a size word selected by a fixed comparison. */
export function scanSource(text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '');
    if (!SIZE_WORD.test(line)) return;
    for (const { condition, yes, no } of ternaries(line)) {
      if (!SIZE_WORD.test(yes) && !SIZE_WORD.test(no)) continue;
      const fixed = FIXED_COMPARE.test(condition);
      const signOnly = !fixed && SIGN_COMPARE.test(condition) && SIZE_WORD.test(yes) && SIZE_WORD.test(no);
      if (fixed || signOnly) { findings.push({ line: index + 1, condition: condition.trim().slice(-90), text: raw.trim().slice(0, 160) }); break; }
    }
    // `if (x < N) return '…보합권…'` — a guard whose return is the word.
    const guard = /\bif\s*\((.*)\)\s*return\s*(.*)$/.exec(line);
    if (guard && SIZE_WORD.test(guard[2]) && FIXED_COMPARE.test(guard[1]) && !findings.some((f) => f.line === index + 1)) findings.push({ line: index + 1, condition: guard[1].slice(-90), text: raw.trim().slice(0, 160) });
  });
  return findings;
}

const SCAN_ROOTS = ['src', 'scripts/lib', 'scripts/producer', 'js'];
const EXCLUDE = new Set(['src/domain/market/session/move-size.js']);
function walk(dir, out = []) {
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = `${dir}/${name}`;
    const stat = statSync(path.join(root, rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (/\.(?:m?js)$/.test(name) && !EXCLUDE.has(rel)) out.push(rel);
  }
  return out;
}

function selfTest() {
  const bad = [
    "const w = Math.abs(krw) < RULES.fx.krwFlatPct ? '보합권' : '원화 약세';",
    "if (Math.abs(g) < C.gold20dPct) return `금은 ${g}로 크게 움직이지 않았습니다.`;",
    "const s = kospiMove <= -5 ? `주가는 크게 내려` : '';",
    "direction: row.ret5d < 0 ? '5거래일 급락' : '5거래일 급등',"
  ];
  const good = [
    "const w = grade === 'small' ? '보합권' : '원화 약세';",
    "['5거래일 급등 기준', shockOn ? '유지' : null],",
    "direction: `5거래일 ${moveVerb(row.ret5d, grade)}`,",
    "const t = vix5 >= RULES.volatility.spike5dPct ? `VIX 5일 ${signed(vix5)} 상승` : '';"
  ];
  const missed = bad.filter((line) => !scanSource(line).length);
  const wrong = good.filter((line) => scanSource(line).length);
  if (missed.length || wrong.length) { console.error(`move-size word self-test failed: missed ${JSON.stringify(missed)} flagged ${JSON.stringify(wrong)}`); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  selfTest();
  if (process.argv.includes('--self-test')) { console.log('move-size word self-test: PASS'); process.exit(0); }
  const filesArg = process.argv.indexOf('--files');
  const files = filesArg >= 0 ? String(process.argv[filesArg + 1] || '').split(',').filter(Boolean) : SCAN_ROOTS.flatMap((dir) => walk(dir));
  const failures = [];
  for (const file of files) for (const finding of scanSource(readFileSync(path.join(root, file), 'utf8'))) failures.push(`${file}:${finding.line} ${finding.text}`);
  if (failures.length) {
    console.error(`v60.19 move-size word check: ${failures.length} size word(s) picked by a fixed number — read the grade from src/domain/market/session/move-size.js (the move against its own volatility), or name the policy line instead of a size word:\n${failures.map((line) => ` - ${line}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`move-size word check: PASS (${files.length} files)`);
}
