// scripts/fixtures/pipeline-semantics/qa.mjs — v59.45 pipeline review regressions (QA runner candidate binding)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = process.cwd();

export const cases = [
  { id: 'P3-QA-02', name: 'staged blob over 1 MiB still gets a digest in candidate binding', run: async () => {
      const source = readFileSync('scripts/qa-runner.mjs', 'utf8');
      const fn = source.match(/const stagedDigest = \(file\) => \{[\s\S]*?\n  \};/)?.[0];
      assert.ok(fn, 'stagedDigest helper is present in qa-runner.mjs');
      const file = 'public-data/knowledge/research-dossiers.json';
      const size = Number(spawnSync('git', ['cat-file', '-s', `:${file}`], { cwd: root, encoding: 'utf8' }).stdout.trim());
      assert.ok(size > 1024 * 1024, `${file} is larger than the 1 MiB spawnSync default (${size})`);
      const digest = vm.runInNewContext(`${fn}\nstagedDigest(${JSON.stringify(file)})`, { spawnSync, candidateRepo: root, createHash, Buffer, Number, String });
      const full = spawnSync('git', ['show', `:${file}`], { cwd: root, encoding: 'buffer', maxBuffer: size + 1 });
      assert.equal(digest, createHash('sha256').update(full.stdout).digest('hex'));
  } },
  { id: 'QA-01', name: 'a knowledge authoring helper change selects the knowledge generated-parity gate', run: async () => {
      for (const file of ['scripts/lib/knowledge-authoring-contract.mjs', 'scripts/lib/principles-stories.mjs', 'scripts/lib/principles-worked.mjs']) {
        const run = spawnSync(process.execPath, ['scripts/qa-runner.mjs', 'affected', '--files', file, '--explain'], { cwd: root, encoding: 'utf8', timeout: 20000 });
        assert.equal(run.status, 0, run.stderr);
        const plan = JSON.parse(run.stdout);
        assert.ok(plan.gates.some((gate) => gate.id === 'knowledge-generated-parity'), `${file} selects knowledge-generated-parity`);
      }
  } },
];
