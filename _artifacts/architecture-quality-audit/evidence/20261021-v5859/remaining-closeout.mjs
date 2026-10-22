import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const dir = '_artifacts/architecture-quality-audit/evidence/20261021-v5859';
const names = fs.readdirSync(dir).filter(n => /^(?:REMAINING-|remaining-|chat-probe-|ui-shell-probe-|workflow-probe-|workspace-tool-probe-|qa-runner-probe-)/.test(n) && !/closeout\.(?:json|log)$/.test(n));
const files = [...new Set([...names, 'assemble.mjs', 'coverage.json', 'reading-ledger.json', 'reading-ledger.tsv', 'HANDOFF.md', 'DECISION-QUALITY.md', 'VALIDATION.md', 'artifact-integrity-result.json'].map(n => `${dir}/${n}`))].filter(p => fs.existsSync(p));
const identity = [];
for (const name of names.filter(n => /reading\.tsv$/.test(n))) {
  const lines = fs.readFileSync(`${dir}/${name}`, 'utf8').trim().split(/\r?\n/);
  const keys = lines.shift().split('\t');
  for (const l of lines) {
    const row = Object.fromEntries(l.split('\t').map((v, i) => [keys[i], v]));
    const current = crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex');
    identity.push({ path: row.path, fixedSha256: row.sha256 || row.blobSHA256, currentSha256: current, exactCurrentMatch: current === (row.sha256 || row.blobSHA256) });
  }
}
fs.writeFileSync(`${dir}/remaining-target-current-identity.json`, JSON.stringify({ observedAt: new Date().toISOString(), files: identity.length, matching: identity.filter(r => r.exactCurrentMatch).length, rows: identity }, null, 2) + '\n');
files.push(`${dir}/remaining-target-current-identity.json`);
const temp = path.resolve('.cache/audit-remaining-temp');
fs.mkdirSync(temp, { recursive: true });
const args = ['scripts/qa-runner.mjs', 'affected', '--session', 'audit-remaining-20261021-v5861', '--files', files.join(','), '--no-cache'];
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, TMP: temp, TEMP: temp } });
fs.writeFileSync(`${dir}/remaining-closeout.log`, String(result.stdout || '') + '\n' + String(result.stderr || ''));
const report = { startedAt, finishedAt: new Date().toISOString(), command: { exe: 'node', args }, selectedFiles: files, tempDirectory: temp, exitCode: result.status, error: result.error?.message || null, scope: 'Audit-owned paths only; current-checkout preflight, not pinned product full QA or deployed certification. No root repository commit/push/deploy.' };
fs.writeFileSync(`${dir}/remaining-closeout.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, command: undefined, selectedFiles: files.length }, null, 2));
console.log(String(result.stdout || '').slice(-4500));
if (result.status !== 0) process.exitCode = 1;
