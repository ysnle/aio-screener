#!/usr/bin/env node
// Reachability tooling for the classic js/*.js runtime (shared window globals).
//   node scripts/dead-code.mjs report [js/aio-data.js ...]   candidates: top-level names with no reference
//                                                           outside their own statement (tests/gates listed)
//   node scripts/dead-code.mjs remove <file> <name,name>     delete those top-level statements + leading comments
//   node scripts/dead-code.mjs self-test                     splitter/remover fixture (run by the workspace gate)
// A report is a candidate list, not a verdict: names in RULES.md are contracts, string-built references
// (`window['_aio' + x]`, onclick="name(", data-action) are invisible to it, and a test-only reference means
// the function and its test go together (R675). Read-only except `remove`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { splitTopLevel, describeStatement } from './lib/js-toplevel.mjs';

const root = process.cwd();
const SKIP = new Set(['node_modules', '.git', 'public-data', '_artifacts', '.cache', 'content', '_backup', '_archive', 'worktrees']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(?:js|mjs|html)$/.test(entry.name)) out.push(path);
  }
  return out;
}

function statements(text) {
  return splitTopLevel(text).map(([a, b]) => ({ a, b, name: describeStatement(text.slice(a, b)).name })).filter((s) => s.name);
}

function removeStatements(source, names) {
  const crlf = source.includes('\r\n');
  const s = source.replace(/\r\n/g, '\n');
  const wanted = new Set(names);
  let out = '';
  let cursor = 0;
  const removed = [];
  for (const st of statements(s)) {
    if (!wanted.has(st.name) || st.a < cursor) continue;
    const lineStart = s.lastIndexOf('\n', st.a - 1) + 1;
    // P1347: line expansion must never consume a neighbouring statement.
    let a = /^\s*$/.test(s.slice(lineStart, st.a)) ? lineStart : st.a;
    for (;;) {
      const prevEnd = a - 1;
      if (a !== lineStart || prevEnd <= 0) break;
      const prevStart = s.lastIndexOf('\n', prevEnd - 1) + 1;
      if (/^\s*(\/\/|\/\*|\*)/.test(s.slice(prevStart, prevEnd))) a = prevStart; else break;
    }
    const nl = s.indexOf('\n', st.b);
    const lineEnd = nl < 0 ? s.length : nl;
    const b = /^\s*$/.test(s.slice(st.b, lineEnd)) ? (nl < 0 ? s.length : nl + 1) : st.b;
    out += s.slice(cursor, a);
    cursor = b;
    removed.push(st.name);
  }
  out = (out + s.slice(cursor)).replace(/\n{4,}/g, '\n\n\n');
  return { text: crlf ? out.replace(/\n/g, '\r\n') : out, removed, missing: names.filter((n) => !removed.includes(n)) };
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'self-test') {
  const fixture = '// keep\nfunction keep() { return used(); }\n// dead helper\nfunction dead() {\n  return `x${1}`;\n}\nvar used = function() { return /}/.test("}"); };\nwindow.AIO.x = 1;\nvar hook = function() { return 1; }\n_aioPageBus.register(\'k\', \'aio:pageShown\', function() { hook(); });\n';
  const names = statements(fixture).map((s) => s.name).join(',');
  const { text, removed } = removeStatements(fixture, ['dead']);
  // The page-bus registration after an ASI-terminated `var hook = function(){}` must stay its own statement.
  const hookRemoval = removeStatements(fixture, ['hook']).text;
  const sameLine = removeStatements('var dead = function() {}; window.sideEffect();\n', ['dead']).text;
  const adjacent = removeStatements('function dead() {} function keep() {}\n', ['dead']).text;
  const leading = removeStatements('window.sideEffect(); function dead() {}\n', ['dead']).text;
  if (!sameLine.includes('window.sideEffect();') || !adjacent.includes('function keep() {}') || !leading.includes('window.sideEffect();')) {
    throw new Error('P1347: removing a statement must preserve same-line neighbours');
  }
  if (names !== 'keep,dead,used,AIO.x,hook' || removed.join() !== 'dead' || /dead/.test(text) || !/function keep/.test(text) || !/var used/.test(text) || !/_aioPageBus\.register/.test(hookRemoval) || /var hook/.test(hookRemoval)) {
    console.error(`dead-code self-test failed: names=${names} removed=${removed} text=${JSON.stringify(text)}`);
    process.exit(1);
  }
  console.log('dead-code self-test OK');
} else if (mode === 'remove') {
  const [file, list] = args;
  if (!file || !list) throw new Error('usage: dead-code.mjs remove <file> <name,name>');
  const result = removeStatements(readFileSync(file, 'utf8'), list.split(','));
  writeFileSync(file, result.text);
  console.log(`removed: ${result.removed.join(', ') || '(none)'}${result.missing.length ? ` | NOT FOUND: ${result.missing.join(', ')}` : ''}`);
  if (result.missing.length) process.exitCode = 1;
} else if (mode === 'report') {
  const targets = args.length ? args : readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js') && f !== 'aio-tests.js').map((f) => `js/${f}`);
  const corpus = walk(root).map((path) => [relative(root, path).replace(/\\/g, '/'), readFileSync(path, 'utf8')]);
  const rules = readFileSync(join(root, '_context', 'RULES.md'), 'utf8');
  const rows = [];
  for (const target of targets) {
    const text = readFileSync(join(root, target), 'utf8');
    for (const st of statements(text)) {
      const leaf = st.name.split('.').pop();
      if (leaf.length < 4) continue;
      const re = new RegExp(`(^|[^\\w$])${leaf.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
      const own = (text.slice(st.a, st.b).match(re) || []).length;
      const refs = corpus.map(([path, body]) => [path, (body.match(re) || []).length - (path === target ? own : 0)]).filter(([, n]) => n > 0);
      const runtime = refs.filter(([path]) => !/^scripts\/|aio-tests\.js$/.test(path));
      if (runtime.length) continue;
      const body = text.slice(st.a, st.b);
      // `x = register(...)` / `x = (function(){...})()` runs at load: removing it removes the side effect.
      const sideEffect = /^[^=]*=\s*(?:new\s+)?(?!function\b|async\b)[\w$.]+\s*\(|^[^=]*=\s*\(\s*(?:async\s+)?function[\s\S]*\}\s*\)\s*\(/.test(body);
      rows.push({ file: target, name: st.name, lines: body.split('\n').length, onlyIn: refs.map(([path]) => path), rule: rules.includes(leaf), sideEffect });
    }
  }
  rows.sort((x, y) => y.lines - x.lines);
  for (const r of rows) console.log(`${r.file}\t${r.name}\t${r.lines}\t${r.rule ? 'RULES-NAMED(keep)' : r.sideEffect ? 'SIDE-EFFECT(keep)' : r.onlyIn.length ? `refs:${r.onlyIn.join(' ')}` : 'unreferenced'}`);
  console.log(`candidates=${rows.length} lines=${rows.reduce((s, r) => s + r.lines, 0)} (verify string-built references before removing)`);
} else {
  console.error('usage: node scripts/dead-code.mjs report|remove|self-test');
  process.exit(2);
}
