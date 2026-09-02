// Non-executing inspection of every current code file and historical code blob.
// This is syntax/structure evidence, never a substitute for semantic review.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as yaml from 'js-yaml';
// Node ships this parser for its own tooling. Evaluate only the trusted bundled
// parser, never repository/history source. Record the runtime/parser versions.
const parserSandbox = { exports: {} };
parserSandbox.module = { exports: parserSandbox.exports };
const parserSource = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
if (!parserSource) throw new Error('Bundled Acorn unavailable; no parse claims can be made');
vm.runInNewContext(parserSource, parserSandbox, { timeout: 3000 });
const parser = parserSandbox.exports;
if (typeof parser.parse !== 'function') throw new Error('Parser initialization failed');
const dir = '_artifacts/exhaustive-audit-20260831';
const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const code = name => /\.(?:[cm]?js|jsx|tsx?|html?|css|scss|py|ps1|sh|bash|sql|ya?ml|toml)$/.test(name);
const currentPaths = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString('utf8').split('\0'))]
  .filter(name => name && !name.startsWith(`${dir}/`) && fs.existsSync(name) && fs.statSync(name).isFile());
const report = { schema: 'whole-tree-static-inspection.v1', nodeVersion: process.version, parserVersion: parser.version, startedAt: new Date().toISOString(), head: manifest.head,
  boundary: 'Every JS/ESM source is parsed without execution; HTML script extraction is lexical. YAML and JSON are parsed. Other languages are explicitly unparsed. Hazard counts are review candidates, not proven bugs. Historical blobs are inspected once per unique blob/type and mapped to all transitions. No semantic-review credit is granted.',
  current: [], history: [], graph: null, historicalCodeTransitions: manifest.commits.reduce((n, c) => n + c.changes.filter(f => code(f.path)).length, 0) };
const parseJs = (source, filename, baseLine = 0) => {
  let ast;
  try { ast = parser.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (moduleError) {
    if (filename.endsWith('.mjs') || filename.startsWith('src/')) throw moduleError;
    ast = parser.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowReturnOutsideFunction: filename.endsWith('.cjs') });
  }
  const imports = [], exports = [], functions = [], hazards = {}, locations = [];
  const normalizedAst = node => JSON.stringify(node, (key, value) => ['start', 'end', 'loc', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens'].includes(key) ? undefined : value);
  const signal = (kind, node) => { hazards[kind] = (hazards[kind] || 0) + 1; locations.push({ kind, line: baseLine + (node.loc?.start.line || 1) }); };
  const pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source?.value) imports.push(node.source.value);
    if (node.type === 'CallExpression' && node.callee?.type === 'Import') {
      if (node.arguments[0]?.type === 'StringLiteral') imports.push(node.arguments[0].value);
      else signal('dynamic-import-nonliteral', node);
    }
    if (node.type === 'ImportExpression') {
      if (typeof node.source?.value === 'string') imports.push(node.source.value);
      else signal('dynamic-import-nonliteral', node);
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration?.id?.name) exports.push(node.declaration.id.name);
      for (const declaration of node.declaration?.declarations || []) if (declaration.id?.name) exports.push(declaration.id.name);
      for (const specifier of node.specifiers || []) if (specifier.exported?.name) exports.push(specifier.exported.name);
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      const start = baseLine + node.loc.start.line, end = baseLine + node.loc.end.line;
      functions.push({ name: node.id?.name || '(anonymous)', start, end, lines: end - start + 1,
        bodyHash: end - start >= 8 && node.body ? hash(normalizedAst(node.body)) : null });
    }
    if (node.type === 'CatchClause' && node.body?.body?.length === 0) signal('empty-catch', node);
    if (node.type === 'AssignmentExpression' && ['innerHTML', 'outerHTML'].includes(node.left?.property?.name)) signal('html-sink', node);
    if (node.type === 'CallExpression' && node.callee?.name === 'eval') signal('eval', node);
    if (node.type === 'NewExpression' && node.callee?.name === 'Function') signal('new-function', node);
    if (node.type === 'LogicalExpression' && node.operator === '||' && node.right?.type === 'Literal' && node.right.value === 0) signal('falsy-to-zero', node);
    if (node.type === 'CallExpression' && ['setInterval', 'setTimeout'].includes(node.callee?.name)) signal('timer', node);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'extra', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) pending.push(...value.filter(item => item && typeof item === 'object' && item.type));
      else if (value && typeof value === 'object' && value.type) pending.push(value);
    }
  }
  return { imports: [...new Set(imports)], exports: [...new Set(exports)], functions, hazards, locations };
};
function inspect(filename, bytes, keepDetails = false) {
  const text = bytes.toString('utf8');
  const item = { path: filename, sha256: hash(bytes), bytes: bytes.length, lines: text.split('\n').length - Number(text.endsWith('\n')), status: 'unparsed', method: null };
  try {
    if (/\.(?:[cm]?js|jsx|tsx?)$/.test(filename)) {
      const result = parseJs(text, filename);
      Object.assign(item, keepDetails ? result : { hazards: result.hazards, functionCount: result.functions.length });
      item.method = 'Node-bundled Acorn; module/script grammar';
      item.status = 'parsed';
    } else if (/\.html?$/.test(filename)) {
      const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
      item.scripts = scripts.map(match => {
        const line = text.slice(0, match.index).split('\n').length;
        if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) return { line, status: 'external-or-empty' };
        if (/type\s*=\s*["'](?:application\/ld\+json|application\/json|importmap)["']/i.test(match[1])) { JSON.parse(match[2]); return { line, status: 'json-parsed' }; }
        const result = parseJs(match[2], filename, line - 1);
        return { line, status: 'js-parsed', ...(keepDetails ? result : { hazards: result.hazards }) };
      });
      item.method = 'lexical HTML script extraction + Acorn/JSON parser'; item.status = 'scripts-parsed';
    } else if (/\.ya?ml$/.test(filename)) { yaml.loadAll(text); item.status = 'parsed'; item.method = 'js-yaml'; }
    else if (/\.json$/.test(filename)) { JSON.parse(text); item.status = 'parsed'; item.method = 'JSON.parse'; }
  } catch (error) { item.status = 'parse-failed'; item.error = String(error.message); }
  return item;
}
for (const filename of currentPaths.filter(name => code(name) || name.endsWith('.json'))) report.current.push(inspect(filename, fs.readFileSync(filename), code(filename)));
const edges = report.current.flatMap(item => (item.imports || []).filter(name => name.startsWith('.')).map(name => ({ from: item.path, to: path.posix.normalize(path.posix.join(path.posix.dirname(item.path), name.split('?')[0])) })));
const reachable = new Set(), queue = ['src/app/bootstrap.js'];
while (queue.length) { const filename = queue.pop(); if (reachable.has(filename)) continue; reachable.add(filename); queue.push(...edges.filter(edge => edge.from === filename).map(edge => edge.to)); }
const bodies = new Map();
for (const item of report.current.filter(item => item.path.startsWith('src/'))) for (const fn of item.functions || []) {
  if (!fn.bodyHash) continue;
  const group = bodies.get(fn.bodyHash) || [];
  group.push({ path: item.path, ...fn }); bodies.set(fn.bodyHash, group);
}
report.graph = { edges, unresolvedImports: edges.filter(edge => !fs.existsSync(edge.to)), runtimeReachable: [...reachable].sort(),
  runtimeUnreachableCandidates: report.current.filter(item => item.path.startsWith('src/') && item.path.endsWith('.js') && !reachable.has(item.path)).map(item => item.path),
  identicalFunctionBodies: [...bodies.values()].filter(group => new Set(group.map(item => item.path)).size > 1) };
fs.writeFileSync(`${dir}/static-current.json`, JSON.stringify({ ...report, history: undefined }, null, 2) + '\n');
console.log(JSON.stringify({ stage: 'current', files: report.current.length, failures: report.current.filter(item => item.status === 'parse-failed').length, unparsed: report.current.filter(item => item.status === 'unparsed').length }));
const versions = new Map();
if (process.argv.includes('--current-only')) process.exit(0);
for (const commit of manifest.commits) for (const change of commit.changes.filter(item => code(item.path))) for (const blob of [change.before, change.after]) {
  if (/^0+$/.test(blob)) continue;
  const key = `${blob}:${path.extname(change.path)}`;
  if (!versions.has(key)) versions.set(key, { blob, path: change.path, exampleCommit: commit.sha });
}
const versionsList = [...versions.values()];
for (let start = 0; start < versionsList.length; start += 30) {
  const batch = versionsList.slice(start, start + 30);
  const output = execFileSync('git', ['cat-file', '--batch'], { input: batch.map(item => item.blob).join('\n') + '\n', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  let offset = 0;
  for (const version of batch) {
    const end = output.indexOf(10, offset);
    const [blob, type, sizeString] = output.subarray(offset, end).toString('utf8').split(' ');
    const size = Number(sizeString);
    if (blob !== version.blob || type !== 'blob' || !Number.isInteger(size)) throw new Error(`Unexpected Git blob response: ${blob}`);
    const bytes = output.subarray(end + 1, end + 1 + size);
    offset = end + 1 + size + 1;
    report.history.push({ ...version, ...inspect(version.path, bytes) });
  }
  if (start % 300 === 0) {
    fs.writeFileSync(`${dir}/static-history-progress.json`, JSON.stringify({ inspected: report.history.length, total: versionsList.length, asOf: new Date().toISOString() }) + '\n');
    console.log(JSON.stringify({ stage: 'history', inspected: report.history.length, total: versionsList.length }));
  }
}
report.completedAt = new Date().toISOString();
fs.writeFileSync(`${dir}/static-audit.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ stage: 'complete', current: report.current.length, historicalBlobs: report.history.length,
  currentFailures: report.current.filter(item => item.status === 'parse-failed').length, historicalFailures: report.history.filter(item => item.status === 'parse-failed').length }));
