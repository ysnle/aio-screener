#!/usr/bin/env node
// v59.85 (data-automation redesign): the shared data publisher, driven against a throwaway bare remote, and the wiring
// that makes it the only commit path. Behaviour, not workflow text: each case builds a real race, conflict or
// timestamp-only rewrite and checks what reached the remote, what the runner's worktree looks like afterwards and which
// dispatches were asked for.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publish } from './publish-data-commit.mjs';
import { DATA_PUBLISH_SETS, publishSetPaths, publishSetsForWorkflow, workflowPublishes } from './lib/data-publish-sets.mjs';
import { ARTIFACT_FRESHNESS, freshnessLedgerPath } from '../src/data/contracts/artifact-freshness.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`); };
const run = (cwd, cmd, args) => {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
};
const git = (cwd, ...args) => run(cwd, 'git', args);

// ---------- 1. Behaviour against a bare remote ----------
const tmp = mkdtempSync(join(tmpdir(), 'aio-publish-'));
const remote = join(tmp, 'remote.git');
const ghLog = join(tmp, 'gh.log');
const ghBin = join(tmp, 'gh');
writeFileSync(ghBin, `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(ghLog)}\n`);
chmodSync(ghBin, 0o755);
const outFile = join(tmp, 'github-output');
const savedEnv = { ...process.env };
const savedCwd = process.cwd();
Object.assign(process.env, { AIO_PUBLISH_GH: ghBin, AIO_PUBLISH_SLEEP_MS: '0', AIO_PUBLISH_NOW: '2026-11-08T15:00:00Z', GITHUB_OUTPUT: outFile,
  GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'f@x', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'f@x' });

const SETS = {
  data: { workflow: 'fixture.yml', message: 'data: fixture', candidateFile: null, required: ['out/a.json'], optional: ['out/b.json', 'out/missing.json'],
    timestampOnly: { 'out/b.json': ['generatedAt'] }, afterStage: [], beforeCommit: [], verifyCommit: ['test ! -e out/poison'],
    onRebaseFail: 'collision', collision: { workflow: 'fixture.yml', inputs: { trigger: 'scheduler' } }, ciOrigin: 'fixture' },
  strict: { workflow: 'fixture.yml', message: 'data: strict', candidateFile: null, required: [], optional: ['out/a.json'], timestampOnly: {},
    afterStage: [], beforeCommit: [], verifyCommit: [], onRebaseFail: 'fail', collision: null, ciOrigin: null },
};

function fresh() {
  rmSync(remote, { recursive: true, force: true });
  for (const name of ['runner', 'other']) rmSync(join(tmp, name), { recursive: true, force: true });
  rmSync(ghLog, { force: true });
  writeFileSync(outFile, '');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  const seed = join(tmp, 'runner');
  git(tmp, 'clone', '-q', remote, seed);
  mkdirSync(join(seed, 'out'), { recursive: true });
  writeFileSync(join(seed, 'out/a.json'), '{"v":1}\n');
  writeFileSync(join(seed, 'out/b.json'), '{"generatedAt":"2026-11-08T00:00:00Z","v":1}\n');
  writeFileSync(join(seed, 'notes.txt'), 'seed\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
  git(seed, 'branch', '-q', '--set-upstream-to=origin/main');
  git(tmp, 'clone', '-q', remote, join(tmp, 'other'));
  return { runner: seed, other: join(tmp, 'other') };
}
const otherPush = (other, file, body) => { writeFileSync(join(other, file), body); git(other, 'add', '-A'); git(other, 'commit', '-q', '-m', `other ${file}`); git(other, 'push', '-q', 'origin', 'HEAD:main'); };
const inRepo = (cwd, args) => { process.chdir(cwd); try { return publish({ sets: SETS, ...args }); } finally { process.chdir(savedCwd); } };
const remoteLog = () => git(tmp, '--git-dir', remote, 'log', '--format=%s', 'main');
const ghCalls = () => (existsSync(ghLog) ? readFileSync(ghLog, 'utf8').trim().split('\n').filter(Boolean) : []);
const outputs = () => Object.fromEntries(readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=')));
const clean = (cwd) => git(cwd, 'status', '--porcelain', '--untracked-files=no') === '';
const midRebase = (cwd) => existsSync(join(cwd, '.git/rebase-merge')) || existsSync(join(cwd, '.git/rebase-apply'));

try {
  { // nothing changed
    const { runner } = fresh();
    const code = inRepo(runner, { set: 'data' });
    check('v59.85 an unchanged set makes no commit and reports changed=false', code === 0 && outputs().changed === 'false' && remoteLog().split('\n').length === 1 && ghCalls().length === 0);
  }
  { // a run checked out on another branch must not push that branch's code into main with its data
    const { runner } = fresh();
    git(runner, 'checkout', '-q', '-b', 'feature');
    writeFileSync(join(runner, 'out/a.json'), '{"v":7}\n');
    const code = inRepo(runner, { set: 'data' });
    check('v59.85 a run checked out on a feature branch is refused before staging', code === 1 && remoteLog().split('\n').length === 1 && ghCalls().length === 0);
  }
  { // timestamp-only rewrite goes back to HEAD in index and worktree
    const { runner } = fresh();
    writeFileSync(join(runner, 'out/b.json'), '{"generatedAt":"2026-11-08T14:00:00Z","v":1}\n');
    const code = inRepo(runner, { set: 'data' });
    check('v59.85 a timestamp-only rewrite is put back (no commit, clean worktree)', code === 0 && outputs().changed === 'false' && clean(runner)
      && readFileSync(join(runner, 'out/b.json'), 'utf8').includes('00:00:00Z'));
  }
  { // a real change pushes and dispatches exact-SHA CI; a timestamp-only neighbour is not carried along
    const { runner } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":2}\n');
    writeFileSync(join(runner, 'out/b.json'), '{"generatedAt":"2026-11-08T14:00:00Z","v":1}\n');
    const code = inRepo(runner, { set: 'data' });
    const sha = git(runner, 'rev-parse', 'HEAD');
    check('v59.85 a change is pushed with the minute in the message', code === 0 && remoteLog().split('\n')[0] === 'data: fixture 2026-11-08T15:00Z' && outputs().sha === sha);
    check('v59.85 the push dispatches CI for the exact SHA', ghCalls().join('|') === `workflow run ci.yml --ref main -f release_sha=${sha} -f origin=fixture`, ghCalls().join('|'));
    check('v59.85 the timestamp-only neighbour stayed out of the commit', !git(runner, 'show', '--name-only', '--format=', 'HEAD').includes('out/b.json'));
  }
  { // a failed CI dispatch after the push is a warning and hands converge no sha to wait on
    const { runner } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":9}\n');
    const failing = join(tmp, 'gh-fail');
    writeFileSync(failing, '#!/usr/bin/env bash\nexit 1\n');
    chmodSync(failing, 0o755);
    process.env.AIO_PUBLISH_GH = failing;
    const code = inRepo(runner, { set: 'data' });
    process.env.AIO_PUBLISH_GH = ghBin;
    check('v59.85 a failed CI dispatch after the push ends green without a sha hand-over', code === 0 && outputs().changed === 'true' && !('sha' in outputs()) && remoteLog().split('\n')[0].startsWith('data: fixture'));
  }
  { // lost race: rebase onto the other push, with an unrelated dirty tracked file in the runner's worktree
    const { runner, other } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":3}\n');
    writeFileSync(join(runner, 'notes.txt'), 'runner scratch edit\n'); // tracked, modified, not in the set
    otherPush(other, 'other.txt', 'concurrent\n');
    const code = inRepo(runner, { set: 'data' });
    const log = remoteLog().split('\n');
    check('v59.85 a lost race rebases (autostash) and pushes on top of the other commit', code === 0 && log[0].startsWith('data: fixture') && log[1] === 'other other.txt', log.join(' / '));
    check('v59.85 the runner keeps its unrelated worktree edit through the rebase', readFileSync(join(runner, 'notes.txt'), 'utf8') === 'runner scratch edit\n' && !midRebase(runner));
  }
  { // conflict: one collision re-run is dispatched, the run ends green, no half rebase is left
    const { runner, other } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":4}\n');
    otherPush(other, 'out/a.json', '{"v":"human"}\n');
    const code = inRepo(runner, { set: 'data' });
    check('v59.85 a rebase conflict dispatches one collision re-run and ends green', code === 0 && outputs().collision === 'true' && outputs().changed === 'false'
      && ghCalls().join('|') === 'workflow run fixture.yml --ref main -f trigger=scheduler -f retry=collision' && !midRebase(runner), ghCalls().join('|'));
    check('v59.85 the conflicting cycle published nothing', remoteLog().split('\n')[0] === 'other out/a.json');
  }
  { // the collision re-run colliding again fails loudly
    const { runner, other } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":5}\n');
    otherPush(other, 'out/a.json', '{"v":"human"}\n');
    const code = inRepo(runner, { set: 'data', retry: 'collision' });
    check('v59.85 a second collision exits 1 without dispatching again', code === 1 && ghCalls().length === 0 && !midRebase(runner));
  }
  { // a rebased tree that no longer verifies is not pushed
    const { runner, other } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":6}\n');
    otherPush(other, 'out/poison', 'x\n');
    const code = inRepo(runner, { set: 'data' });
    check('v59.85 a rebased tree that fails verifyCommit is not pushed (collision path)', code === 0 && outputs().collision === 'true' && remoteLog().split('\n')[0] === 'other out/poison');
  }
  { // onRebaseFail: fail
    const { runner, other } = fresh();
    writeFileSync(join(runner, 'out/a.json'), '{"v":7}\n');
    otherPush(other, 'out/a.json', '{"v":"human"}\n');
    const code = inRepo(runner, { set: 'strict' });
    check("v59.85 onRebaseFail 'fail' exits 1 on a conflict", code === 1 && ghCalls().length === 0 && !midRebase(runner));
  }
  { // missing required output, unparsable JSON
    const { runner } = fresh();
    rmSync(join(runner, 'out/a.json'));
    check('v59.85 a missing required output refuses the run', inRepo(runner, { set: 'data' }) === 1 && remoteLog().split('\n').length === 1);
    const second = fresh();
    writeFileSync(join(second.runner, 'out/a.json'), '{"v":');
    check('v59.85 unparsable staged JSON refuses the run', inRepo(second.runner, { set: 'data' }) === 1 && remoteLog().split('\n').length === 1);
  }
} catch (error) {
  failures.push(`fixture crashed: ${error.stack || error.message}`);
} finally {
  process.chdir(savedCwd);
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- 2. Wiring: the table is the contract the workflows and the freshness registry share ----------
const read = (file) => readFileSync(join(root, file), 'utf8');
for (const [id, set] of Object.entries(DATA_PUBLISH_SETS)) {
  const workflow = read(`.github/workflows/${set.workflow}`);
  check(`v59.85 ${set.workflow} publishes set ${id} through the shared publisher`, workflow.includes(`scripts/publish-data-commit.mjs --set ${id}`));
  check(`v59.85 set ${id} declares a collision workflow only with the collision policy`, (set.onRebaseFail === 'collision') === Boolean(set.collision));
  if (set.collision) check(`v59.85 ${set.collision.workflow} accepts the retry input the collision re-run sends`, /\n\s+retry:\n/.test(read(`.github/workflows/${set.collision.workflow}`)));
  for (const path of set.required) check(`v59.85 set ${id} required path ${path} is not also optional`, !set.optional.includes(path));
  for (const path of Object.keys(set.timestampOnly || {})) check(`v59.85 set ${id} timestamp-only rule names a staged path (${path})`, publishSetPaths(id).includes(path));
}
for (const workflow of new Set(Object.values(DATA_PUBLISH_SETS).map((set) => set.workflow))) {
  const text = read(`.github/workflows/${workflow}`);
  check(`v59.85 ${workflow} keeps no hand-written push loop`, !/until git push|git push origin HEAD:main|stage_if_exists/.test(text));
}
for (const [file, spec] of Object.entries(ARTIFACT_FRESHNESS)) {
  check(`v59.85 ${file} is committed by a publish set of ${spec.workflow}`, workflowPublishes(spec.workflow, `public-data/${file}`), `sets: ${publishSetsForWorkflow(spec.workflow).join(', ') || 'none'}`);
  if (spec.ledger !== false) check(`v59.85 ${spec.workflow} commits its freshness ledger`, workflowPublishes(spec.workflow, freshnessLedgerPath(spec.workflow)));
}

if (failures.length) {
  console.error('Publish data commit check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Publish data commit OK: ${Object.keys(DATA_PUBLISH_SETS).length} sets; race, autostash, conflict, second collision, verify-after-rebase, timestamp-only and refusal cases pass against a bare remote.`);
