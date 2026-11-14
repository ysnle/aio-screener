#!/usr/bin/env node
// Consumers name the colour role, not its old alias: var(--bg-card) becomes var(--color-background-card). The map is
// read from the alias definitions in index.html (`--old: var(--color-…)`), so it cannot drift from them. After the
// rewrite, an alias nothing references any more loses its definition. Usage: node scripts/codemod-color-roles.mjs [--write]
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

const html = read('index.html');
const map = new Map();
for (const match of html.matchAll(/(--[a-z][a-z0-9-]*):\s*var\((--color-[a-z-]+)\)\s*;/g)) {
  if (!match[1].startsWith('--color-')) map.set(match[1], match[2]);
}
const names = [...map.keys()].map((name) => name.slice(2)).sort((a, b) => b.length - a.length);
const consumer = new RegExp(`var\\(\\s*--(${names.join('|')})\\s*([,)])`, 'g');

const targets = ['index.html', ...walk('src').filter((file) => /\.(js|css)$/.test(file)), ...walk('js').filter((file) => file.endsWith('.js') && !file.endsWith('aio-tests.js'))];
let rewritten = 0;
const texts = new Map();
for (const file of targets) {
  const before = read(file);
  const after = before.replace(consumer, (whole, name, tail) => { rewritten += 1; return `var(${map.get(`--${name}`)}${tail}`; });
  texts.set(file, after);
}
// An alias is still needed while any file names it outside its own definition (scripts and tests read some by name).
const everything = [...texts.values(), ...walk('scripts').filter((file) => file.endsWith('.mjs') && !file.endsWith('codemod-color-roles.mjs')).map(read), read('js/aio-tests.js')].join('\n');
const unused = [...map.keys()].filter((alias) => {
  const uses = everything.match(new RegExp(`${alias}(?![\\w-])`, 'g')) || [];
  const definitions = everything.match(new RegExp(`${alias}:\\s*var\\(`, 'g')) || [];
  return uses.length === definitions.length;
});
let shell = texts.get('index.html');
for (const alias of unused) shell = shell.replace(new RegExp(`\\s*${alias}:\\s*var\\(--color-[a-z-]+\\)\\s*;`, 'g'), '');
texts.set('index.html', shell);
if (write) for (const [file, text] of texts) if (text !== read(file)) writeFileSync(join(root, file), text);
console.log(JSON.stringify({ aliases: map.size, rewritten, removedDefinitions: unused.length, kept: [...map.keys()].filter((alias) => !unused.includes(alias)) }));
