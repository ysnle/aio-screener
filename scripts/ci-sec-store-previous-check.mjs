// v59.61 (release TLA+ model, owner choice "keep the previous digest"): replays, with real git in a throwaway repository,
// the path the model found — refresh-screener publishes a new SEC ledger to data-store, then its main push fails — and
// checks that a CI checkout of main (whose manifest still names the replaced ledger) restores that ledger with
// `restore --match-manifest` instead of skipping the full-ledger gates. Also: the chain never grows past one parent, a
// third publish drops the oldest ledger, and the producer's own restore still reads the newest.
// It copies the real scripts/sec-fundamentals-store.mjs and its libs into the throwaway repo, so it runs the shipped code.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(`[sec-store-previous] ${message}`); };
const base = mkdtempSync(join(tmpdir(), 'aio-sec-store-'));
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0', GITHUB_REPOSITORY: '' };
const run = (cwd, cmd, args) => {
  const result = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) fail(`${cmd} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
};
const git = (cwd, ...args) => run(cwd, 'git', args);

function checkout(name) {
  const dir = join(base, name);
  git(base, 'clone', '-q', '-b', 'main', join(base, 'origin.git'), dir);
  return dir;
}
const ledger = (n) => ({ meta: { generatedAt: `2026-11-0${n}T00:00:00Z` }, data: { [`CIK${n}`]: { entityName: `Issuer ${n}` } } });
function writeLocal(dir, n) { writeFileSync(join(dir, 'public-data', 'sec-fundamentals.json'), JSON.stringify(ledger(n))); }
const store = (dir, ...args) => JSON.parse(run(dir, process.execPath, ['scripts/sec-fundamentals-store.mjs', ...args]).split('\n').pop());

try {
  git(base, 'init', '-q', '--bare', 'origin.git');
  const seed = join(base, 'seed');
  mkdirSync(join(seed, 'scripts', 'lib'), { recursive: true });
  mkdirSync(join(seed, 'public-data'), { recursive: true });
  for (const file of ['scripts/sec-fundamentals-store.mjs', 'scripts/lib/sec-ledger.mjs', 'scripts/lib/sec-ledger-store.mjs']) cpSync(join(ROOT, file), join(seed, file));
  writeFileSync(join(seed, '.gitignore'), 'public-data/sec-fundamentals.json\n');
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'remote', 'add', 'origin', join(base, 'origin.git'));

  // Screener run 1: publish ledger 1, then main names it.
  writeLocal(seed, 1);
  const first = store(seed, 'publish');
  const manifest = (sha256) => writeFileSync(join(seed, 'public-data', 'sec-fundamentals-summary.manifest.json'), JSON.stringify({ sourceSha256: sha256, records: 1 }));
  manifest(first.sha256);
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'main names ledger 1');
  git(seed, 'push', '-q', 'origin', 'main');

  // Screener run 2: publish ledger 2, then the main push fails (nothing is pushed to main).
  writeLocal(seed, 2);
  const second = store(seed, 'publish');
  if (second.sha256 === first.sha256) fail('the two ledgers share a digest');

  // CI on main (manifest = ledger 1): before v59.61 this returned source none (gates skipped).
  const ci = checkout('ci');
  const restored = store(ci, 'restore', '--match-manifest');
  if (restored.source !== 'store-previous' || restored.sha256 !== first.sha256) fail(`CI restore after a failed push: ${JSON.stringify(restored)}`);

  // The producer's own restore (no manifest match) reads the newest ledger.
  const producer = checkout('producer');
  const newest = store(producer, 'restore');
  if (newest.source !== 'store' || newest.sha256 !== second.sha256) fail(`producer restore: ${JSON.stringify(newest)}`);

  // Run 3 publishes ledger 3 on top: the store keeps 3 and 2 only, one parent deep.
  writeLocal(seed, 3);
  store(seed, 'publish');
  const tip = git(seed, 'ls-remote', 'origin', 'refs/heads/data-store').split(/\s+/)[0];
  const probe = checkout('probe');
  git(probe, 'fetch', '-q', 'origin', '+refs/heads/data-store:refs/remotes/origin/data-store');
  const parents = git(probe, 'rev-list', '--parents', '-n', '1', tip).split(' ').slice(1);
  if (parents.length !== 1) fail(`store tip has ${parents.length} parents`);
  if (git(probe, 'rev-list', '--count', tip) !== '2') fail('store chain grew past one previous ledger');
  const stale = store(ci, 'restore', '--match-manifest', '--force');
  if (stale.source !== 'none') fail(`a ledger two publishes back must not be restorable: ${JSON.stringify(stale)}`);

  console.log(JSON.stringify({ ok: true, afterFailedPush: restored.source, producer: newest.source, chain: 2, twoBack: stale.source }));
} finally {
  rmSync(base, { recursive: true, force: true });
}

