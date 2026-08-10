import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const baseline = JSON.parse(await readFile(new URL('architecture/security-sink-baseline.json', root), 'utf8'));
const headers = await readFile(new URL('_headers', root), 'utf8');
const rootPath = new URL('../', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');
const files = ['index.html'];
async function collect(directory) {
  for (const entry of await readdir(join(rootPath, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (path.startsWith('js' + join('', '')) && path.endsWith('.js') || path.startsWith('src' + join('', '')) && path.endsWith('.js')) files.push(relative(rootPath, join(rootPath, path)));
  }
}
await collect('js');
await collect('src');
let innerHTMLAssignments = 0;
let unsafeEval = 0;
for (const relative of files) {
  const text = await readFile(join(rootPath, relative), 'utf8');
  innerHTMLAssignments += (text.match(/\.innerHTML\s*=/g) || []).length;
  unsafeEval += (text.match(/\beval\s*\(|\bnew\s+Function\s*\(/g) || []).length;
}
const errors = [];
if (innerHTMLAssignments > baseline.innerHTMLAssignmentsMax) errors.push(`innerHTML assignments ${innerHTMLAssignments} > ${baseline.innerHTMLAssignmentsMax}`);
if (unsafeEval > baseline.unsafeEvalMax) errors.push(`unsafe eval/new Function ${unsafeEval} > ${baseline.unsafeEvalMax}`);
if (!/^\/\*\r?\n/m.test(headers) || !/Content-Security-Policy:/.test(headers) || !/live|observed|operator/i.test(headers)) errors.push('active _headers block or live-observation boundary missing');
if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log(`CSP sink ratchet check OK: innerHTML assignments=${innerHTMLAssignments}/${baseline.innerHTMLAssignmentsMax}, unsafe eval=${unsafeEval}, live header status=${baseline.liveHeadersStatus}.`);
