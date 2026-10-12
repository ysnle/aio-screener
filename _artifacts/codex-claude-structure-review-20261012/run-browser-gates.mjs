// Review harness only. Preserve every pre-existing gate artifact byte for byte.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../..');
const cases = [
  ['entity', 'scripts/ci-entity-quality-browser-check.mjs', '_artifacts/entity-quality-20261012'],
  ['responsive', 'scripts/ci-responsive-browser-check.mjs', '_artifacts/responsive-browser']
];
const summary = [];
for (const [name, script, relative] of cases) {
  const directory = resolve(root, relative);
  if (!directory.startsWith(root + sep)) throw new Error('Artifact directory escapes workspace');
  const files = () => existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name) : [];
  const before = new Map(files().map(file => [file, readFileSync(resolve(directory, file))]));
  const evidence = resolve(out, 'browser-gates', name);
  mkdirSync(evidence, { recursive: true });
  const chunks = [];
  const started = Date.now();
  let code;
  try {
    code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [script], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', data => chunks.push(data));
      child.stderr.on('data', data => chunks.push(data));
      child.on('error', reject);
      child.on('exit', done);
    });
  } finally {
    writeFileSync(resolve(out, `${name}-browser.log`), Buffer.concat(chunks));
    for (const file of files()) {
      const target = resolve(directory, file);
      const current = readFileSync(target);
      const original = before.get(file);
      if (!original || !current.equals(original)) writeFileSync(resolve(evidence, file), current);
      if (original) writeFileSync(target, original);
      else rmSync(target);
    }
    for (const [file, original] of before) {
      const target = resolve(directory, file);
      if (!existsSync(target)) writeFileSync(target, original);
      if (!readFileSync(target).equals(original)) throw new Error(`Original artifact not preserved: ${target}`);
    }
  }
  summary.push({ name, script, exitCode: code, durationMs: Date.now() - started, preservedFiles: before.size,
    beforeSha256: Object.fromEntries([...before].map(([file, bytes]) => [file, createHash('sha256').update(bytes).digest('hex')])) });
  writeFileSync(resolve(out, 'browser-gates.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${name}: exit ${code}; ${before.size} original artifact files preserved`);
}
if (summary.some(row => row.exitCode !== 0)) process.exitCode = 1;
