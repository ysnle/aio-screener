// Read existing producer blobs only; no producer, workflow or remote mutation.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const report = readFileSync(resolve(root, '_artifacts/codex-audit-20260930/REMOTE-PRODUCER-RECEIPT.md'), 'utf8');
const rows = [...report.matchAll(/^\| ((?:public-data|architecture)\/[^|]+?) \| `([a-f0-9]{40})` \| (\d+) \|/gm)];
if (rows.length !== 11) throw new Error('exact 11-file producer batch required');
const received = {};
for (const [, path, sha, size] of rows) {
  const blob = JSON.parse(execFileSync('gh', ['api', `repos/ysnle/aio-screener/git/blobs/${sha}`], { encoding: 'utf8', maxBuffer: 12e6 }));
  const bytes = Buffer.from(blob.content.replace(/\s/g, ''), 'base64');
  const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (blob.encoding !== 'base64' || bytes.length !== Number(size) || actual !== sha) throw new Error(`invalid producer blob ${path}`);
  received[path] = { bytes, json: JSON.parse(bytes.toString('utf8')), sha };
}
const revision = received['public-data/market-snapshot.json'].json.revision;
for (const path of ['architecture/asset-manifest.json', 'architecture/release-manifest.json', 'public-data/operations-status.json']) {
  if (received[path].json.dataRevision !== revision) throw new Error(`mixed batch ${path}`);
}
const base = resolve(root, '_artifacts/codex-semantic-audit-20260930/producer-receipt');
for (const [path, { bytes }] of Object.entries(received)) {
  for (const kind of ['original', 'received']) mkdirSync(dirname(resolve(base, kind, path)), { recursive: true });
  writeFileSync(resolve(base, 'original', path), readFileSync(resolve(root, path)));
  writeFileSync(resolve(base, 'received', path), bytes);
}
const applied = [];
try {
  for (const [path, { bytes }] of Object.entries(received)) { writeFileSync(resolve(root, path), bytes); applied.push(path); }
} catch (error) {
  for (const path of applied) writeFileSync(resolve(root, path), readFileSync(resolve(base, 'original', path)));
  throw error;
}
writeFileSync(resolve(base, 'receipt.json'), JSON.stringify({ sourceCommit: '9896adec45cc5de78fba2af481554602f3e89c6d', revision, excluded: 'public-config.json', files: Object.entries(received).map(([path, item]) => ({ path, gitBlobSha: item.sha, bytes: item.bytes.length })) }, null, 2) + '\n');
console.log(`Received 11 verified producer blobs: ${revision}; public-config preserved.`);
