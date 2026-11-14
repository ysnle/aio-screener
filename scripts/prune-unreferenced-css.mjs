#!/usr/bin/env node
// Removes style rules that no markup or script can ever match: a selector is dead when one of the classes or ids it
// requires is not written anywhere in index.html's markup, js/ or src/ — neither whole nor as the prefix of a name
// built at runtime ('is-' + state, `tile--${tone}`). Selectors made only of elements, attributes and pseudo-classes
// are kept. Usage: node scripts/prune-unreferenced-css.mjs [--write]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const read = (file) => readFileSync(join(root, file), 'utf8');
const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const file = `${dir}/${name}`;
  return statSync(join(root, file)).isDirectory() ? walk(file) : [file];
});

const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const html = read('index.html');
const sources = [
  html.replace(STYLE_BLOCK, ''),
  ...walk('src').filter((file) => file.endsWith('.js')).map(read),
  ...walk('js').filter((file) => file.endsWith('.js') && !file.endsWith('aio-tests.js')).map(read),
].join('\n');

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const known = new Map();
function referenced(name) {
  if (known.has(name)) return known.get(name);
  let found = new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`).test(sources);
  for (let at = 0; !found && at < name.length - 1; at += 1) {
    if (name[at] !== '-' && name[at] !== '_') continue;
    const prefix = escape(name.slice(0, at + 1));
    found = new RegExp(`(?<![\\w-])${prefix}(?:\\$\\{|['"\`]\\s*\\+|['"\`]\\s*,|['"\`]\\s*\\))`).test(sources);
  }
  known.set(name, found);
  return found;
}

function splitSelectors(list) {
  const out = []; let depth = 0; let current = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(current); current = ''; } else current += ch;
  }
  out.push(current);
  return out.map((item) => item.trim()).filter(Boolean);
}

// The names a selector needs: classes and ids outside :not(), :is(), :where() and :has() (those are alternatives or
// exclusions, not requirements).
function requiredNames(selector) {
  let text = selector.replace(/\[[^\]]*\]/g, '');
  for (let pass = 0; pass < 6; pass += 1) text = text.replace(/:(?:not|is|where|has|matches)\((?:[^()]|\([^()]*\))*\)/g, '');
  return [...text.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map((match) => match[1]);
}

const stats = [];
function prune(css, label) {
  let removedRules = 0; let removedSelectors = 0;
  let out = css.replace(/([^{}]*?)(\{[^{}]*\})/g, (whole, pre, block) => {
    const cut = Math.max(pre.lastIndexOf(';'), pre.lastIndexOf('*/'));
    const head = cut >= 0 ? pre.slice(0, cut + (pre[cut] === ';' ? 1 : 2)) : '';
    const selectorText = pre.slice(head.length);
    const trimmed = selectorText.trim();
    if (!trimmed || trimmed.startsWith('@') || /^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(trimmed)) return whole;
    const selectors = splitSelectors(selectorText);
    const live = selectors.filter((selector) => requiredNames(selector).every(referenced));
    if (live.length === selectors.length) return whole;
    removedSelectors += selectors.length - live.length;
    if (!live.length) { removedRules += 1; return head; }
    const lead = /^\s*/.exec(selectorText)[0];
    return `${head}${lead}${live.join(', ')} ${block}`;
  });
  // Blocks the removal emptied (a media query or layer with nothing left) go too.
  for (let pass = 0; pass < 4; pass += 1) out = out.replace(/@(?:media|supports|container)[^{}]*\{\s*\}/g, '');
  stats.push({ label, before: css.length, after: out.length, removedRules, removedSelectors });
  return out;
}

const styleDir = 'src/ui/styles';
for (const name of readdirSync(join(root, styleDir)).filter((file) => file.endsWith('.css'))) {
  const file = `${styleDir}/${name}`;
  const before = read(file);
  const after = prune(before, file);
  if (write && after !== before) writeFileSync(join(root, file), after);
}
{
  const after = html.replace(STYLE_BLOCK, (block) => {
    const open = block.slice(0, block.indexOf('>') + 1);
    return open + prune(block.slice(open.length, -'</style>'.length), 'index.html <style>') + '</style>';
  });
  if (write && after !== html) writeFileSync(join(root, 'index.html'), after);
}
if (process.argv.includes('--names')) console.log([...known].filter(([, found]) => !found).map(([name]) => name).sort().join(' '));
const total = stats.reduce((sum, row) => ({ before: sum.before + row.before, after: sum.after + row.after, removedRules: sum.removedRules + row.removedRules, removedSelectors: sum.removedSelectors + row.removedSelectors }), { before: 0, after: 0, removedRules: 0, removedSelectors: 0 });
for (const row of stats.filter((item) => item.removedSelectors).sort((a, b) => (b.before - b.after) - (a.before - a.after))) {
  console.log(`${row.label}: ${row.removedRules} rules, ${row.removedSelectors} selectors, ${row.before - row.after} bytes`);
}
console.log(`${write ? 'removed' : 'would remove'}: ${total.removedRules} rules, ${total.removedSelectors} selectors, ${total.before - total.after} of ${total.before} bytes`);
