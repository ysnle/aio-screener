import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'C:/Projects/AIO';
const OUT = process.argv[2];
const pipeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'architecture/qa-pipeline.json'), 'utf8'));

const browserGroups = Object.entries(pipeline.groups)
  .filter(([name]) => name.startsWith('browser-'))
  .sort((a, b) => (a[1].phase ?? 0) - (b[1].phase ?? 0) || a[0].localeCompare(b[0]));

const gates = [];
for (const [group, definition] of browserGroups) {
  for (const gate of definition.gates || []) gates.push({ group, ...gate });
}

console.log(`sweeping ${gates.length} browser gates`);
const results = [];
for (const gate of gates) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [gate.script, ...(gate.args || [])], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: gate.timeoutMs || 300000,
    env: { ...process.env, ...(gate.env || {}) },
    maxBuffer: 64 * 1024 * 1024,
  });
  const record = {
    id: gate.id,
    group: gate.group,
    script: gate.script,
    status: r.status,
    signal: r.signal,
    timedOut: r.error ? /ETIMEDOUT|timed out/i.test(String(r.error.message)) : false,
    durationMs: Date.now() - started,
    stdout: (r.stdout || '').slice(-4000),
    stderr: (r.stderr || '').slice(-6000),
  };
  results.push(record);
  console.log(`[sweep] ${record.status === 0 ? 'PASS' : 'FAIL'} ${gate.id} (${record.durationMs}ms)`);
}

const summary = {
  sweptAt: new Date().toISOString(),
  total: results.length,
  pass: results.filter((r) => r.status === 0).length,
  fail: results.filter((r) => r.status !== 0).length,
  failedIds: results.filter((r) => r.status !== 0).map((r) => r.id),
  results,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(`[sweep] pass=${summary.pass} fail=${summary.fail} -> ${OUT}`);
console.log(`[sweep] failed: ${summary.failedIds.join(', ') || 'none'}`);
