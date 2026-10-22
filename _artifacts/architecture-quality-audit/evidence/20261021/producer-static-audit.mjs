import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ref = 'd36bb256ddf60468d6c7a134628053c5796be6be', base = 'df6f0b33';
const dir = '_artifacts/architecture-quality-audit/evidence/20261021';
const read = (sha, path) => execFileSync('git', ['show', `${sha}:${path}`], { maxBuffer: 30e6, encoding: 'utf8' });
const hash = (text) => createHash('sha256').update(text).digest('hex');
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, 'scripts/producer'], { encoding: 'utf8' }).trim().split('\n');
const old = read(base, 'scripts/fetch-data.mjs');
const functions = (text) => new Map([...text.matchAll(/^(?:export )?(?:async )?function (\w+)\b[^\n]*(?:\n[\s\S]*?^\}|\s*\})[^\n]*/gm)].map((m) => [m[1], m[0].replace(/^export /, '')]));
const oldFunctions = functions(old);
const comparisons = [];
for (const path of [...files, 'scripts/fetch-data.mjs']) {
  const text = read(ref, path);
  for (const [name, body] of functions(text)) {
    comparisons.push({ path, name, status: oldFunctions.has(name) ? oldFunctions.get(name) === body ? 'EXACT' : 'CHANGED' : 'NEW' });
    if (oldFunctions.has(name) && oldFunctions.get(name) !== body) {
      writeFileSync(`${dir}/producer-base-${name}.txt`, oldFunctions.get(name));
      writeFileSync(`${dir}/producer-current-${name}.txt`, body);
    }
  }
}
writeFileSync(`${dir}/producer-function-comparison.json`, JSON.stringify(comparisons, null, 2) + '\n');
writeFileSync(`${dir}/producer-reading.tsv`, ['path\tstatus\tbaseSha256\tsha256\treason', ...[...files, 'scripts/fetch-data.mjs'].map((path) => `${path}\tFULL\t${path === 'scripts/fetch-data.mjs' ? hash(old) : ''}\t${hash(read(ref, path))}\t고정 REF 전문 의미 검토; 기존 fetch-data 함수 이전 및 main 호출순서 비교, producer 실행 없음`)].join('\n') + '\n');
console.log(JSON.stringify({ files: files.length + 1, counts: Object.fromEntries(['EXACT','CHANGED','NEW'].map((status) => [status, comparisons.filter((r) => r.status === status).length])), changed: comparisons.filter((r) => r.status === 'CHANGED'), added: comparisons.filter((r) => r.status === 'NEW') }, null, 2));
