import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const roots = ['js', 'scripts', 'src', 'worker'];
const rootFiles = ['cloudflare-worker-proxy.js', 'sw.js'];
const files = [...rootFiles];
const packageFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(?:m?js)$/i.test(entry)) files.push(relative(root, path).replaceAll('\\', '/'));
    else if (entry === 'package.json') packageFiles.push(path);
  }
}

for (const directory of roots) walk(join(root, directory));
const failures = [];
const allFiles = [...new Set(files)].sort();

// Per-file digest cache (local runs only): a file whose exact bytes already passed `node --check` under the
// same Node version and package "type" context is not re-spawned. CI=true, AIO_QA_NO_CACHE=1 (set by
// qa-runner --no-cache) and --no-cache check every file; a missing/unreadable cache means every file is checked.
const useCache = process.env.CI !== 'true' && process.env.AIO_QA_NO_CACHE !== '1' && !process.argv.includes('--no-cache');
const cacheDir = process.env.AIO_QA_CACHE_DIR ? resolve(process.env.AIO_QA_CACHE_DIR) : join(root, '.cache', 'aio-qa');
const cachePath = join(cacheDir, 'syntax-check-cache.json');
const sha = (value) => createHash('sha256').update(value).digest('hex');
// `node --check` on a .js file depends on the nearest package.json "type", so those bytes are part of the key.
const context = sha(JSON.stringify([process.version, ...[join(root, 'package.json'), ...packageFiles.sort()]
  .map((path) => [relative(root, path).replaceAll('\\', '/'), existsSync(path) ? sha(readFileSync(path)) : null])]));
const digests = new Map();
let cached = {};
if (useCache) {
  try {
    const stored = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (stored?.schemaVersion === 'aio-syntax-cache.v1' && stored.context === context && stored.files) cached = stored.files;
  } catch { /* no cache yet or unreadable: every file is checked */ }
}
const queue = allFiles.filter((file) => {
  if (!useCache) return true;
  let digest;
  try { digest = sha(readFileSync(join(root, file))); } catch { return true; }
  digests.set(file, digest);
  return cached[file] !== digest;
});

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

if (useCache) {
  // Only passing digests are recorded, so a failing file is re-checked on every run until fixed.
  const failed = new Set(failures.map(({ file }) => file));
  const passed = Object.fromEntries(allFiles.filter((file) => digests.has(file) && !failed.has(file)).map((file) => [file, digests.get(file)]));
  const tmp = `${cachePath}.${process.pid}.tmp`;
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(tmp, `${JSON.stringify({ schemaVersion: 'aio-syntax-cache.v1', context, files: passed })}\n`);
    renameSync(tmp, cachePath);
  } catch (error) {
    try { unlinkSync(tmp); } catch { /* nothing to clean up */ }
    console.warn(`[syntax] cache not written (${error.code || error.message}); the next run checks every file`);
  }
}

if (failures.length) {
  console.error(`Syntax check failed: ${failures.length}/${allFiles.length} file(s).`);
  failures.forEach(({ file, message }) => console.error(` - ${file}: ${message}`));
  process.exit(1);
}
console.log(`Syntax check OK: ${allFiles.length} JS/ESM files (${queue.length} checked, ${allFiles.length - queue.length} unchanged since a cached pass; ${jobs} workers).`);
