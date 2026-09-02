// Parse historical shell text without executing any historical command/hook.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
const dir = '_artifacts/exhaustive-audit-20260831';
const source = JSON.parse(fs.readFileSync(`${dir}/static-audit.json`, 'utf8'));
const results = [];
for (const entry of source.history.filter(row => /\.(sh|bash)$/.test(row.path))) {
  const input = execFileSync('git', ['cat-file', 'blob', entry.blob], { maxBuffer: 32 * 1024 * 1024 });
  const result = spawnSync('C:/Program Files/Git/bin/bash.exe', ['-n'], { input, encoding: 'utf8', windowsHide: true });
  results.push({ path: entry.path, blob: entry.blob, method: 'bash -n (no execution)', status: result.status === 0 ? 'parsed' : 'parse-failed', error: result.error?.message || result.stderr.trim() || null });
}
fs.writeFileSync(`${dir}/shell-audit.json`, JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n');
console.log(JSON.stringify({ parsed: results.length, failed: results.filter(row => row.status !== 'parsed').length }));
if (results.some(row => row.status !== 'parsed')) process.exitCode = 1;
