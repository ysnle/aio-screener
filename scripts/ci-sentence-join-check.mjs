#!/usr/bin/env node
// v60.28: sentence joins that print ".," or ".." on screen. The 시장 상태 outlook printed "주도 섹터·테마는 테마 화면에서
// 확인합니다., 상대강도는 몇 주 늦게 반영" and "…확인합니다.. 선도였지만": a sentence that ends with its own period was
// joined to the next part by ", " or by a part that starts with ". ". The text is built in many places, so this reads the
// Korean string literals of product code (src/**, js/*) and follows the joins a static read can see:
//   chain     — a literal ending in "." followed by `+ <operand>` (up to four operands) where the operand is a literal, a
//               parenthesised ternary or a same-file `const` whose literal starts with ", " or ". ";
//   interp    — a template piece ending in "." directly before `${name}` where `name` is such a const;
//   join      — an array literal joined with ", " or ". " (`[…].join(', ')`, through .filter(…), or a same-file one-line
//               helper `const join = (items) => items….join(', ')`) holding an element literal that ends in ".";
//   literal   — ".," or ".." (not "..." or "…") inside one Korean literal.
//   nested    — in 매크로 text (src/domain/macro/**), a parenthesis opened inside another one, counting the literals inside a
//               `${}` at the depth where they are placed ('3.7% (10월, 13개월 연율 2.6% (25년 9월 대비, …))'). A value
//               placed from a property is out of a static read; maxParenDepth is exported for the runtime checks.
// Comments and regex literals are not text. KNOWN_PENDING lists hits in files another thread owns; an entry that no
// longer hits fails as stale, so the list only shrinks.
//   node scripts/ci-sentence-join-check.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HANGUL = /[가-힣]/;
const ENDS_WITH_PERIOD = /[^.\s]\.$/;
const STARTS_WITH_JOIN = /^[.,]\s/;

// Hits in files another thread owns, left for that owner (2026-11-18: the screener condition note joins its sentences with
// ", " and prints "…규칙이 아닙니다., 자료 없음 조건은 …"). Key: file|rule|the hit's literal text (line numbers move).
export const KNOWN_PENDING = Object.freeze([]);

function listFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) out.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));
  for (const name of fs.readdirSync(path.join(ROOT, 'js'))) if (name.endsWith('.js')) out.push(path.join(ROOT, 'js', name));
  return out.sort();
}

// A small JS lexer: string and template literals (with nested `${}`), comments and regex literals. Returns the literals
// and a masked copy of the source where comments and literal bodies are spaces (offsets kept), for bracket matching.
export function lexLiterals(src) {
  const literals = [];
  const masked = src.split('');
  const n = src.length;
  const blank = (from, to) => { for (let k = from; k < to; k += 1) if (masked[k] !== '\n') masked[k] = ' '; };
  const regexAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  const regexWords = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
  const readString = (i) => {
    const quote = src[i];
    let j = i + 1;
    while (j < n && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    literals.push({ kind: 'str', start: i, end: j + 1, text: src.slice(i + 1, j), pieces: [{ text: src.slice(i + 1, j), end: j }], interps: [] });
    blank(i + 1, j);
    return j + 1;
  };
  // scan code from i until the closing '}' of depth 0 (when inInterp) or the end; returns the index after it.
  const scan = (i, inInterp) => {
    let depth = 0;
    let prev = '';
    let word = '';
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { const end = src.indexOf('\n', i); const stop = end < 0 ? n : end; blank(i, stop); i = stop; continue; }
      if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); const stop = end < 0 ? n : end + 2; blank(i, stop); i = stop; continue; }
      if (c === '"' || c === "'") { i = readString(i); prev = '"'; word = ''; continue; }
      if (c === '`') { i = readTemplate(i); prev = '`'; word = ''; continue; }
      if (c === '/' && (regexAfter.has(prev) || regexWords.has(word))) {
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) break;
          j += 1;
        }
        blank(i + 1, j);
        i = j + 1;
        prev = '/'; word = '';
        continue;
      }
      if (inInterp) {
        if (c === '{') depth += 1;
        else if (c === '}') { if (depth === 0) return i + 1; depth -= 1; }
      }
      if (/[A-Za-z0-9_$]/.test(c)) { word = (/[A-Za-z0-9_$]/.test(src[i - 1] || '') ? word : '') + c; prev = 'w'; }
      else if (!/\s/.test(c)) { prev = c; word = ''; }
      i += 1;
    }
    return i;
  };
  const readTemplate = (i) => {
    const start = i;
    const pieces = [];
    const interps = [];
    let text = '';
    let pieceStart = i + 1;
    let j = i + 1;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '`') break;
      if (src[j] === '$' && src[j + 1] === '{') {
        pieces.push({ text: src.slice(pieceStart, j), end: j });
        text += `${src.slice(pieceStart, j)}\u0000`;
        const exprStart = j + 2;
        const after = scan(exprStart, true);
        interps.push({ start: exprStart, end: after - 1, src: src.slice(exprStart, after - 1) });
        j = after;
        pieceStart = j;
        continue;
      }
      j += 1;
    }
    pieces.push({ text: src.slice(pieceStart, j), end: j });
    text += src.slice(pieceStart, j);
    literals.push({ kind: 'tpl', start, end: j + 1, text, pieces, interps });
    blank(start + 1, j);
    return j + 1;
  };
  scan(0, false);
  literals.sort((a, b) => a.start - b.start);
  return { literals, masked: masked.join('') };
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** The deepest parenthesis nesting in a rendered text, from `start` (both ASCII and full-width parentheses). */
export function maxParenDepth(text, start = 0) {
  let depth = start;
  let max = start;
  for (const ch of String(text || '')) {
    if (ch === '(' || ch === '（') max = Math.max(max, depth += 1);
    else if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1);
  }
  return max;
}
const NESTED_SCOPE = /^src\/domain\/macro\//;
const firstText = (literal) => literal.pieces[0].text;
const lastText = (literal) => literal.pieces.at(-1).text;
const startsJoin = (literal) => STARTS_WITH_JOIN.test(firstText(literal));
// The whole text with each `${}` as one placeholder character, so `${note}.` ends in a period too.
const endsPeriod = (literal) => HANGUL.test(literal.text) && ENDS_WITH_PERIOD.test(literal.text);

// Find the bracket that matches the one at `at` (forward for an opener, backward for a closer) in the masked source.
function matchBracket(masked, at) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const open = masked[at];
  if (pairs[open]) {
    let depth = 0;
    for (let k = at; k < masked.length; k += 1) {
      if (masked[k] === open) depth += 1;
      else if (masked[k] === pairs[open] && (depth -= 1) === 0) return k;
    }
    return -1;
  }
  const opener = Object.keys(pairs).find((key) => pairs[key] === open);
  let depth = 0;
  for (let k = at; k >= 0; k -= 1) {
    if (masked[k] === open) depth += 1;
    else if (masked[k] === opener && (depth -= 1) === 0) return k;
  }
  return -1;
}

export function scanSource(src, file = '') {
  const { literals, masked } = lexLiterals(src);
  const hits = [];
  const literalAt = new Map(literals.map((literal) => [literal.start, literal]));
  const within = (from, to) => literals.filter((literal) => literal.start >= from && literal.end <= to);
  // A literal inside another literal's `${}` is not where that literal's text starts or ends.
  const nested = new Set(literals.filter((inner) => literals.some((outer) => outer !== inner && outer.start < inner.start && inner.end <= outer.end)));
  const topWithin = (from, to) => within(from, to).filter((literal) => !nested.has(literal));
  // Same-file consts whose value can start with ", " or ". " (`const note = x ? `. 선도…` : ''`): a top-level literal of
  // the statement (a ternary arm), not one inside another literal's `${}`.
  const joinConsts = new Set();
  for (const match of masked.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    const from = match.index + match[0].length;
    const stop = masked.indexOf('\n', from);
    const statementEnd = Math.min(...[masked.indexOf(';', from), stop < 0 ? masked.length : stop].filter((value) => value >= 0));
    if (topWithin(from, statementEnd + 1).some((literal) => startsJoin(literal) && HANGUL.test(literal.text))) joinConsts.add(match[1]);
  }
  // Same-file arrays that receive period-ended sentences: `const notes = ['….']` or `notes.push('….')`.
  const sentenceArrays = new Map();
  const addSentences = (name, open) => {
    const close = matchBracket(masked, open);
    if (close < 0) return;
    const found = topWithin(open, close + 1).filter(endsPeriod);
    if (found.length) sentenceArrays.set(name, [...(sentenceArrays.get(name) || []), ...found]);
  };
  for (const match of masked.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/g)) addSentences(match[1], match.index + match[0].length - 1);
  for (const match of masked.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\.(?:push|unshift)\(/g)) addSentences(match[1], match.index + match[0].length - 1);
  // One-line helpers that join their argument with ", " or ". " (`const join = (items) => items.filter(Boolean).join(', ')`).
  const joinHelpers = new Map();
  for (const match of src.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>\s*[A-Za-z_$][\w$]*(?:\.filter\([^)]*\))?\.join\((['"`])([.,]\s?)\2\)/g)) joinHelpers.set(match[1], match[3]);
  const push = (rule, literal, detail) => hits.push({ file, rule, line: lineOf(src, literal.start), text: literal.text.replace(/\u0000/g, '${…}').slice(-80), detail });

  for (const literal of literals) {
    // literal: ".," or ".." inside one Korean literal (not "..." or "…").
    if (HANGUL.test(literal.text) && literal.pieces.some((piece) => /(?<![\d.])\.\s*,|(?<![\d.])\.\.(?![\d.])/.test(piece.text))) push('literal', literal, 'period followed by comma or period');
    // interp: `….${note}` where note starts with ". " or ", ".
    if (literal.kind === 'tpl' && HANGUL.test(literal.text)) {
      literal.pieces.slice(0, -1).forEach((piece, index) => {
        const name = literal.interps[index]?.src.trim();
        if (ENDS_WITH_PERIOD.test(piece.text) && joinConsts.has(name)) push('interp', literal, `"." before \${${name}}, which starts with a joiner`);
      });
    }
    // chain: a period-ended Korean literal followed by `+ operand…`.
    if (!endsPeriod(literal)) continue;
    let k = literal.end;
    for (let step = 0; step < 4; step += 1) {
      const rest = masked.slice(k, k + 400);
      const plus = rest.match(/^[\s)]*\+\s*/);
      if (!plus) break;
      k += plus[0].length;
      const c = masked[k];
      if (c === '"' || c === "'" || c === '`') {
        const next = literalAt.get(k);
        if (next && startsJoin(next)) { push('chain', literal, `joined to "${firstText(next).slice(0, 20)}"`); break; }
        k = next ? next.end : k + 1;
      } else if (c === '(') {
        const close = matchBracket(masked, k);
        if (close < 0) break;
        const arm = within(k, close + 1).find((item) => startsJoin(item) && HANGUL.test(item.text));
        if (arm) { push('chain', literal, `joined to "${firstText(arm).slice(0, 20)}"`); break; }
        k = close + 1;
      } else {
        const name = masked.slice(k).match(/^[A-Za-z_$][\w$]*/)?.[0];
        if (!name) break;
        if (joinConsts.has(name)) { push('chain', literal, `joined to const ${name}`); break; }
        k += name.length;
        if (masked[k] === '(') { const close = matchBracket(masked, k); if (close < 0) break; k = close + 1; }
      }
    }
  }
  // join: [ … 'text.' … ].join(', ' | '. ') or helper([ … ]).
  const arrayHits = (open, close, sep) => {
    for (const item of within(open, close + 1)) {
      const depth = [...masked.slice(open + 1, item.start)].reduce((d, ch) => d + ('([{'.includes(ch) ? 1 : ')]}'.includes(ch) ? -1 : 0), 0);
      if (depth <= 1 && endsPeriod(item) && masked[item.start - 1] !== '$') push('join', item, `element ends in "." and is joined with "${sep}"`);
    }
  };
  for (const match of masked.matchAll(/\]((?:\s*\.(?:filter|map)\((?:[^()]|\([^()]*\))*\))*)\s*\.join\(/g)) {
    const sepLiteral = literalAt.get(match.index + match[0].length);
    const sep = sepLiteral ? sepLiteral.text : null;
    if (!sep || !/^[.,]\s?$/.test(sep)) continue;
    const open = matchBracket(masked, match.index);
    if (open >= 0) arrayHits(open, match.index, sep);
  }
  for (const match of masked.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)((?:\s*\.(?:filter|map)\((?:[^()]|\([^()]*\))*\))*)\s*\.join\(/g)) {
    const sentencesIn = sentenceArrays.get(match[1]);
    const sepLiteral = literalAt.get(match.index + match[0].length);
    if (!sentencesIn || !sepLiteral || !/^[.,]\s?$/.test(sepLiteral.text)) continue;
    for (const item of sentencesIn) push('join', item, `${match[1]} holds a period-ended sentence and is joined with "${sepLiteral.text}" (line ${lineOf(src, match.index)})`);
  }
  for (const [name, sep] of joinHelpers) {
    for (const match of masked.matchAll(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\(\\s*\\[`, 'g'))) {
      const open = match.index + match[0].length - 1;
      const close = matchBracket(masked, open);
      if (close >= 0) arrayHits(open, close, sep);
    }
  }
  // nested: walk each top-level Korean literal; a literal inside a `${}` starts at the depth where it is placed.
  if (NESTED_SCOPE.test(file)) {
    const childrenOf = (from, to) => within(from, to).filter((inner) => !within(from, to).some((outer) => outer !== inner && outer.start < inner.start && inner.end <= outer.end));
    const deepest = (literal, start) => {
      let depth = start;
      let max = start;
      literal.pieces.forEach((piece, index) => {
        max = Math.max(max, maxParenDepth(piece.text, depth));
        depth = [...piece.text].reduce((d, ch) => ('(（'.includes(ch) ? d + 1 : ')）'.includes(ch) ? Math.max(0, d - 1) : d), depth);
        const interp = literal.interps[index];
        if (interp) for (const child of childrenOf(interp.start, interp.end)) max = Math.max(max, deepest(child, depth));
      });
      return max;
    };
    for (const literal of literals) {
      if (nested.has(literal) || !HANGUL.test(src.slice(literal.start, literal.end))) continue;
      if (deepest(literal, 0) > 1) push('nested', literal, 'a parenthesis opened inside another one');
    }
  }
  const seen = new Set();
  return hits.filter((hit) => { const key = `${hit.rule}|${hit.line}|${hit.text}`; return !seen.has(key) && seen.add(key); });
}

export function scanTree() {
  return listFiles().flatMap((full) => scanSource(fs.readFileSync(full, 'utf8'), path.relative(ROOT, full).replace(/\\/g, '/')));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const probe = scanSource('const t = `${v}% (${m}${y ? `, 13개월 연율 ${x}% (25년 9월 대비)` : \'\'})`;', 'src/domain/macro/probe.js');
  if (!probe.some((hit) => hit.rule === 'nested')) { console.error('[sentence-join] FAIL the nested-parenthesis rule no longer sees a nested template'); process.exit(1); }
  const hits = scanTree();
  const pendingKey = (hit) => `${hit.file}|${hit.rule}|${hit.text}`;
  const pending = new Set(KNOWN_PENDING);
  const fresh = hits.filter((hit) => !pending.has(pendingKey(hit)));
  const stale = KNOWN_PENDING.filter((key) => !hits.some((hit) => pendingKey(hit) === key));
  if (process.argv.includes('--json')) console.log(JSON.stringify({ hits, fresh: fresh.length, stale }, null, 2));
  for (const hit of fresh) console.error(` - ${hit.file}:${hit.line} [${hit.rule}] ${hit.detail} … ${JSON.stringify(hit.text)}`);
  for (const key of stale) console.error(` - stale KNOWN_PENDING entry (no longer hits, remove it): ${key}`);
  if (fresh.length || stale.length) { console.error(`[sentence-join] FAIL ${fresh.length} hit(s), ${stale.length} stale`); process.exit(1); }
  console.log(`[sentence-join] OK: no period-comma or double-period joins (${KNOWN_PENDING.length} pending in other threads' files)`);
}
