import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { posix, win32 } from 'node:path';
const ref = 'd36bb256ddf60468d6c7a134628053c5796be6be', base = 'df6f0b33';
const read = (sha, path) => execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', maxBuffer: 30e6 });
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, 'scripts/producer'], { encoding: 'utf8' }).trim().split('\n');
for (const path of [...files, 'scripts/fetch-data.mjs']) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: read(ref, path), encoding: 'utf8' });
  assert.equal(result.status, 0, `${path}: ${result.stderr}`);
}
console.log('PASS 16 pinned sources syntax-only; no producer import or execution');
const exported = (source) => {
  const out = new Set([...source.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)].map((m) => m[1]));
  for (const m of source.matchAll(/^export \{([^}]+)\}/gm)) for (const raw of m[1].split(',')) out.add(raw.trim().split(/\s+as\s+/).at(-1));
  return out;
};
const currentExports = exported(read(ref, 'scripts/fetch-data.mjs'));
const baseExports = exported(read(base, 'scripts/fetch-data.mjs'));
assert.deepEqual([...baseExports].filter((name) => !currentExports.has(name)), []);
console.log(`PASS fetch-data original exports retained (${baseExports.size})`);
for (const path of [posix, win32]) {
  const root = path === posix ? '/repo' : 'C:\\repo';
  assert.equal(path.resolve(root, 'scripts', '../public-data/data.json'), path.resolve(root, 'scripts/producer', '../../public-data/data.json'));
}
console.log('PASS old/new public-data path roots equivalent (POSIX + Windows)');
const source = read(ref, 'scripts/producer/source-planes.mjs');
const collect = source.slice(source.indexOf('export async function collectSourcePlanes')).replace('export ', '');
const collectSourcePlanes = vm.runInNewContext(`(${collect})`);
const run = await collectSourcePlanes([
  { id: 'fresh', label: 'fresh', run: () => ({ value: 7 }), fallback: () => ({ kept: 0 }) },
  { id: 'throw', label: 'throw', run: () => { throw new Error('fixture'); }, fallback: () => ({ kept: 1 }) },
  { id: 'null', label: 'null', run: async () => null, fallback: () => ({ kept: 2 }) }
], { warn: () => {} });
assert.equal(run.values.fresh.value, 7);
assert.equal(run.values.throw.kept, 1);
assert.equal(run.values.null.kept, 2);
assert.equal(run.failures.throw, 'fixture');
console.log('PASS isolated collectSourcePlanes partial failure/null fallback; fixture functions only');
