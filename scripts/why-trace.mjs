#!/usr/bin/env node
// v58.80 (owner 2026-10-25, pstack /why): the code anchor for `/why`. For a line range or a symbol it lists the commits that
// last touched the lines, every version / P / R / QA id in those lines and commit messages, and the ledger line for each id,
// so the reason behind a guard is read from the record instead of guessed. Read-only.
//   node scripts/why-trace.mjs src/domain/briefing/market-read.js:266-290
//   node scripts/why-trace.mjs --symbol hyWidening20Record
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node scripts/why-trace.mjs <file>[:<start>[-<end>]] | --symbol <name>');
  process.exit(2);
}

let target, lines;
try {
  target = resolveTarget(args);
  lines = readFileSync(target.file, 'utf8').split(/\r?\n/);
  if (target.start > lines.length) throw new Error(`${target.file} has ${lines.length} lines; ${target.start} is past the end`);
} catch (error) {
  console.error(`why-trace: ${error.message}`);
  process.exit(2);
}
const end = Math.min(target.end, lines.length);
const code = lines.slice(target.start - 1, end).join('\n');
const blame = blameCommits(target.file, target.start, end);
const messages = blame.map((commit) => git('log', '-1', '--format=%B', commit.sha)).join('\n');
// Ids written in the lines themselves are the reasons the code cites. A commit message usually covers a whole release
// batch, so its ids are only leads: listed, but their ledger lines are printed only when the lines cite nothing.
const cited = collectIds(code);
const leads = collectIds(messages);
const citedCount = Object.values(cited).reduce((sum, set) => sum + set.size, 0);
const ids = citedCount ? cited : leads;

console.log(`# why-trace ${target.file}:${target.start}-${end}${target.symbol ? ` (${target.symbol})` : ''}\n`);
console.log('## Last-touch commits');
for (const commit of blame) console.log(`- ${commit.sha.slice(0, 10)} ${commit.date} ${commit.summary} (${commit.lines} lines)`);
console.log('\n## Ids cited in the lines');
console.log(Object.entries(cited).map(([kind, set]) => `- ${kind}: ${[...set].join(', ') || '—'}`).join('\n'));
console.log('\n## Ids in the commit messages (release batches; leads, not evidence)');
console.log(Object.entries(leads).map(([kind, set]) => `- ${kind}: ${[...set].filter((id) => !cited[kind].has(id)).join(', ') || '—'}`).join('\n'));
console.log(`\n## Ledger lines (${citedCount ? 'ids cited in the lines' : 'no id in the lines — commit-message leads'})`);
for (const id of ids.P) printLedger('_context/BUG-POSTMORTEM.md', new RegExp(`^## ${id} `), 2);
for (const id of ids.R) printLedger('_context/RULES.md', new RegExp(`^## ${id}\\.`), 1);
for (const id of ids.QA) printLedger('_context/QA-CHECKLIST.md', new RegExp(`${id.replace(/[-]/g, '\\-')}:`), 0);
for (const version of ids.version) printLedger('CHANGELOG.md', new RegExp(`^## ${version.replace('.', '\\.')} `), 0, target.symbol || target.file.split('/').pop().replace(/\.[^.]+$/, ''));
console.log('\nNext: read the cited entries in full by id, then the handoff that names the symbol. A guard with no id above is a finding to report, not a reason to delete it.');

function resolveTarget(argv) {
  if (argv[0] === '--symbol') {
    const symbol = argv[1];
    if (!symbol) throw new Error('--symbol needs a name');
    const name = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `(function\\*?\\s+${name}\\b|\\b(const|let|var)\\s+${name}\\s*=|^\\s*${name}\\s*\\(.*\\)\\s*\\{)`;
    let hits = '';
    try { hits = git('grep', '-n', '-E', pattern, '--', 'src', 'js', 'scripts', 'index.html', 'worker'); } catch { hits = ''; }
    // git grep sorts by path; the product definition in src/ wins over a same-named helper in a gate script.
    const rank = (hit) => ['src/', 'js/', 'worker/', 'index.html', 'scripts/'].findIndex((prefix) => hit.startsWith(prefix));
    const first = hits.split('\n').filter(Boolean).sort((a, b) => rank(a) - rank(b))[0];
    if (!first) throw new Error(`no definition of ${symbol} found in src/ js/ scripts/ index.html worker/`);
    const [file, line] = first.split(':');
    const start = Number(line);
    return { file, start: commentStart(file, start), end: definitionEnd(file, start), symbol };
  }
  const match = /^(.*?)(?::(\d+)(?:-(\d+))?)?$/.exec(argv[0]);
  const file = match[1].replace(/\\/g, '/');
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  const start = match[2] ? Number(match[2]) : 1;
  return { file, start, end: match[3] ? Number(match[3]) : match[2] ? start : Number.MAX_SAFE_INTEGER };
}

// The comment block right above a definition is where this repo writes its version, P and R ids.
function commentStart(file, start) {
  const all = readFileSync(file, 'utf8').split(/\r?\n/);
  let line = start;
  while (line > 1 && /^\s*(\/\/|\/\*|\*)/.test(all[line - 2])) line -= 1;
  return line;
}

// The definition runs to the first line at its own indentation that closes a block, capped at 200 lines.
function definitionEnd(file, start) {
  const all = readFileSync(file, 'utf8').split(/\r?\n/);
  const indent = /^\s*/.exec(all[start - 1])[0].length;
  for (let i = start; i < Math.min(all.length, start + 200); i += 1)
    if (/^\s*[}\]]/.test(all[i]) && /^\s*/.exec(all[i])[0].length === indent) return i + 1;
  return Math.min(all.length, start + 40);
}

function blameCommits(file, start, stop) {
  const out = git('blame', '--line-porcelain', '-L', `${start},${stop}`, '--', file).split('\n');
  const bySha = new Map();
  let sha = null;
  for (const line of out) {
    const head = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
    if (head) { sha = head[1]; if (!bySha.has(sha)) bySha.set(sha, { sha, lines: 0 }); bySha.get(sha).lines += 1; continue; }
    if (line.startsWith('summary ')) bySha.get(sha).summary = line.slice(8);
    if (line.startsWith('committer-time ')) bySha.get(sha).date = new Date(Number(line.slice(15)) * 1000).toISOString().slice(0, 10);
  }
  return [...bySha.values()].filter((commit) => !/^0+$/.test(commit.sha)).sort((a, b) => b.lines - a.lines);
}

function collectIds(text) {
  const grab = (re) => new Set([...text.matchAll(re)].map((m) => m[1]));
  return {
    version: grab(/\b(v\d{2}\.\d{1,2})\b/g),
    P: grab(/\b(P\d{3,4})\b/g),
    R: grab(/\b(R\d{1,4})\b/g),
    QA: grab(/\b(QA-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/g)
  };
}

function printLedger(path, heading, follow, focus = null) {
  if (!existsSync(path)) return;
  const all = readFileSync(path, 'utf8').split(/\r?\n/);
  const at = all.findIndex((line) => heading.test(line));
  if (at < 0) { console.log(`- ${path}: no entry for ${heading.source}`); return; }
  const clip = (line) => (line.length > 220 ? `${line.slice(0, 220)}…` : line);
  console.log(`- ${path}:${at + 1} ${clip(all[at])}`);
  for (let i = 1; i <= follow; i += 1) if (all[at + i]?.trim()) console.log(`    ${clip(all[at + i])}`);
  if (!focus) return;
  // CHANGELOG: the bullets of that version that mention the symbol or file.
  for (let i = at + 1; i < all.length && !/^## v/.test(all[i]); i += 1)
    if (all[i].includes(focus)) console.log(`    ${path}:${i + 1} ${clip(all[i])}`);
}
