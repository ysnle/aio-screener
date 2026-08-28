import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const roots = ['js', 'scripts', 'src', 'worker'];
const rootFiles = ['cloudflare-worker-proxy.js', 'sw.js'];
const files = [...rootFiles];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(?:m?js)$/i.test(entry)) files.push(relative(root, path).replaceAll('\\', '/'));
  }
}

for (const directory of roots) walk(join(root, directory));
const failures = [];
const queue = [...new Set(files)].sort();
let cursor = 0;
const jobs = Math.max(1, Number(process.env.AIO_SYNTAX_JOBS || Math.min(8, Math.max(2, availableParallelism()))));
async function worker() {
  while (cursor < queue.length) {
    const file = queue[cursor++];
    const result = await new Promise((resolveResult) => {
      const child = spawn(process.execPath, ['--check', file], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', (error) => resolveResult({ status: 1, stderr: error.message, stdout }));
      child.on('close', (code) => resolveResult({ status: code, stderr, stdout }));
    });
    if (result.status !== 0) failures.push({ file, message: String(result.stderr || result.stdout || 'syntax failure').trim().split(/\r?\n/).slice(0, 3).join(' ') });
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, () => worker()));

if (failures.length) {
  console.error(`Syntax check failed: ${failures.length}/${files.length} file(s).`);
  failures.forEach(({ file, message }) => console.error(` - ${file}: ${message}`));
  process.exit(1);
}
console.log(`Syntax check OK: ${queue.length} JS/ESM files (${jobs} workers).`);
