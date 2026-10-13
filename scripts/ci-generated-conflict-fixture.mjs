#!/usr/bin/env node
// scripts/ci-generated-conflict-fixture.mjs — fixture gate for resolve-generated-conflicts.mjs and
// resolve-data-manifest-merge.mjs (RULES R626: generated-manifest conflicts merge by field ownership).
//
// Builds a throwaway git repository in os.tmpdir() with a synthetic data-bot vs version-branch conflict
// on the three generated manifests and resolves it in all three polarities (version branch <- main,
// local main <- version branch, rebase). Asserts the code side keeps appRevision / workerRevision /
// operations planes.browser.revision while the data side keeps dataRevision / generatedAt / status, plus
// direct unit cases: a generic "revision" outside planes.browser stays data-owned, and an unclassified
// manifest field stops the merge. Never touches this repository's tree.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UnclassifiedFieldError, resolveConflictText } from './resolve-data-manifest-merge.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const resolver = join(repo, 'scripts', 'resolve-generated-conflicts.mjs');
const errors = [];
let checks = 0;
const check = (label, condition, detail = '') => { checks += 1; if (!condition) errors.push(label + (detail ? `: ${detail}` : '')); };

const manifest = ({ app, data, at }) => ({ schemaVersion: 'fixture.v1', appRevision: app, dataRevision: data, workerRevision: `sw:${app}`, generatedAt: at, evidenceRevision: 'evidence:v1' });
const operations = ({ app, data, at, overall, browserStatus, durable, observedAt }) => ({
  generatedAt: at, appRevision: app, dataRevision: data, overall,
  planes: {
    durable: { status: 'CURRENT', revision: durable },
    browser: { status: browserStatus, revision: app, observedAt }
  },
  ai: { publicChat: { health: { revision: 'v1.00', observedAt: null } } }
});
const base = { app: 'v1.01', data: 'd1', at: 't1', overall: 'OK', browserStatus: 'UNKNOWN', durable: 'd1', observedAt: null };
const code = { ...base, app: 'v1.02' };
const data = { ...base, data: 'd2', at: 't2', overall: 'BLOCKED', browserStatus: 'CURRENT', durable: 'd2', observedAt: 't2' };

function writeTree(dir, state) {
  mkdirSync(join(dir, 'architecture'), { recursive: true });
  mkdirSync(join(dir, 'public-data'), { recursive: true });
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(join(dir, 'version.json'), json({ version: state.app }));
  writeFileSync(join(dir, 'architecture/asset-manifest.json'), json(manifest(state)));
  writeFileSync(join(dir, 'architecture/release-manifest.json'), json(manifest(state)));
  writeFileSync(join(dir, 'public-data/operations-status.json'), json(operations(state)));
}

function scenario(name, steps) {
  const dir = mkdtempSync(join(tmpdir(), 'aio-generated-conflict-'));
  const emptyConfig = join(dir, '..', `${dir.split(/[\\/]/).pop()}.gitconfig`);
  writeFileSync(emptyConfig, '');
  // Isolated git config: the owner's global merge.conflictstyle/hooks must not change the fixture.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
  const git = (...args) => spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: dir, env, encoding: 'utf8' });
  const ok = (...args) => { const r = git(...args); if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr || r.stdout}`); return r; };
  try {
    ok('init', '-q', '-b', 'main');
    writeTree(dir, base); ok('add', '-A'); ok('commit', '-qm', 'base');
    ok('checkout', '-qb', 'ver');
    writeTree(dir, code); ok('add', '-A'); ok('commit', '-qm', 'bump v1.02');
    ok('checkout', '-q', 'main');
    writeTree(dir, data); writeFileSync(join(dir, 'version.json'), `${JSON.stringify({ version: base.app }, null, 2)}\n`);
    ok('add', '-A'); ok('commit', '-qm', 'data refresh');
    ok('update-ref', 'refs/remotes/origin/main', 'main');
    const conflict = steps(git, ok);
    check(`R626 ${name}: synthetic merge conflicts`, conflict.status !== 0, conflict.stdout);
    const run = spawnSync(process.execPath, [resolver, '--skip-gates'], { cwd: dir, env, encoding: 'utf8' });
    check(`R626 ${name}: resolver exits 0`, run.status === 0, `${run.stderr}${run.stdout}`);
    if (run.status !== 0) return;
    check(`R626 ${name}: all three generated manifests actually conflicted`, ['asset-manifest.json', 'release-manifest.json', 'operations-status.json']
      .every((file) => new RegExp(`resolved [^\\n]*${file.replace('.', '\\.')}: [1-9]`).test(run.stdout)), run.stdout);
    const readTemp = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const file of ['architecture/asset-manifest.json', 'architecture/release-manifest.json']) {
      const value = readTemp(file);
      check(`R626 ${name}: ${file} keeps code appRevision/workerRevision`, value.appRevision === 'v1.02' && value.workerRevision === 'sw:v1.02', JSON.stringify(value));
      check(`R626 ${name}: ${file} keeps data dataRevision/generatedAt`, value.dataRevision === 'd2' && value.generatedAt === 't2', JSON.stringify(value));
    }
    const ops = readTemp('public-data/operations-status.json');
    check(`R626 ${name}: operations appRevision + planes.browser.revision come from the code side`, ops.appRevision === 'v1.02' && ops.planes.browser.revision === 'v1.02', JSON.stringify(ops.planes.browser));
    check(`R626 ${name}: operations data fields come from the data side`, ops.dataRevision === 'd2' && ops.generatedAt === 't2' && ops.overall === 'BLOCKED'
      && ops.planes.browser.status === 'CURRENT' && ops.planes.browser.observedAt === 't2' && ops.planes.durable.revision === 'd2', JSON.stringify(ops));
    const unmerged = git('diff', '--name-only', '--diff-filter=U').stdout.trim();
    check(`R626 ${name}: resolved files are staged`, unmerged === '', unmerged);
  } catch (error) {
    check(`R626 ${name}: fixture setup`, false, error.message);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(emptyConfig, { force: true });
  }
}

const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8' });
if (gitVersion.status !== 0) {
  console.error('Generated-conflict fixture needs git on PATH.');
  process.exit(1);
}
scenario('version branch <- origin/main (main = theirs)', (git, ok) => { ok('checkout', '-q', 'ver'); return git('merge', '--no-edit', 'main'); });
scenario('local main <- version branch (main = ours)', (git) => git('merge', '--no-edit', 'ver'));
scenario('rebase version branch onto main (main = ours)', (git, ok) => { ok('checkout', '-q', 'ver'); return git('rebase', 'main'); });

// Direct unit cases for path-sensitive ownership.
const healthBlock = [
  '{',
  '  "ai": {',
  '    "publicChat": {',
  '      "health": {',
  '<<<<<<< ours',
  '        "revision": "v9.01",',
  '=======',
  '        "revision": "v9.02",',
  '>>>>>>> theirs',
  '        "observedAt": null',
  '      }',
  '    }',
  '  }',
  '}',
  ''
].join('\n');
const healthOurs = JSON.parse(resolveConflictText(healthBlock, { file: 'public-data/operations-status.json', dataSide: 'ours' }).text);
const healthTheirs = JSON.parse(resolveConflictText(healthBlock, { file: 'public-data/operations-status.json', dataSide: 'theirs' }).text);
check('R626 a generic "revision" outside planes.browser stays data-owned (live observation)', healthOurs.ai.publicChat.health.revision === 'v9.01' && healthTheirs.ai.publicChat.health.revision === 'v9.02');
let unclassified = null;
try {
  resolveConflictText('{\n<<<<<<< ours\n  "mystery": 1\n=======\n  "mystery": 2\n>>>>>>> theirs\n}\n', { file: 'architecture/asset-manifest.json', dataSide: 'ours' });
} catch (error) { unclassified = error; }
check('R626 an unclassified manifest field stops the merge (R626(4))', unclassified instanceof UnclassifiedFieldError, unclassified?.message || 'no error');
const diff3 = '{\n<<<<<<< ours\n  "appRevision": "v1.02",\n  "dataRevision": "d1"\n||||||| base\n  "appRevision": "v1.01",\n  "dataRevision": "d1"\n=======\n  "appRevision": "v1.01",\n  "dataRevision": "d2"\n>>>>>>> theirs\n}\n';
const diff3Value = JSON.parse(resolveConflictText(diff3, { file: 'architecture/release-manifest.json', dataSide: 'theirs' }).text);
check('R626 diff3-style conflict markers resolve field-level', diff3Value.appRevision === 'v1.02' && diff3Value.dataRevision === 'd2', JSON.stringify(diff3Value));

if (errors.length) {
  console.error('Generated-conflict fixture failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Generated-conflict fixture OK: ${checks} checks (merge both directions + rebase, path-owned planes.browser.revision, unclassified stop, diff3).`);
