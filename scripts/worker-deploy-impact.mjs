import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZERO_SHA = '0'.repeat(40);
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function toRepoPath(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function localImports(source) {
  const imports = [];
  const pattern = /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1].startsWith('./') || match[1].startsWith('../')) imports.push(match[1]);
  }
  return imports;
}

export function collectStaticModuleGraph(entry, visited = new Set()) {
  const absolute = path.resolve(root, entry);
  if (!absolute.startsWith(`${root}${path.sep}`) && absolute !== root) throw new Error(`module escaped repository: ${entry}`);
  if (visited.has(absolute)) return visited;
  visited.add(absolute);
  const source = readFileSync(absolute, 'utf8');
  for (const specifier of localImports(source)) {
    const resolved = path.resolve(path.dirname(absolute), specifier);
    collectStaticModuleGraph(toRepoPath(resolved), visited);
  }
  return visited;
}

export function getWorkerDeploymentInputs() {
  return {
    dataPlane: [
      ...[...collectStaticModuleGraph('worker/data-plane.js')].map(toRepoPath),
      'worker/wrangler.example.toml'
    ].sort(),
    // P1421: pricing/receipt modules are deployable Worker code too.
    aiProxy: [
      ...[...collectStaticModuleGraph('cloudflare-worker-proxy.js')].map(toRepoPath),
      'worker/wrangler.proxy.toml'
    ].sort()
  };
}

export function classifyWorkerDeployChanges(changedPaths) {
  const inputs = getWorkerDeploymentInputs();
  const changed = new Set(changedPaths.map((file) => file.replaceAll('\\', '/').replace(/^\.\//, '')));
  return Object.fromEntries(Object.entries(inputs).map(([plane, paths]) => [plane, paths.some((file) => changed.has(file))]));
}

export function isAncestorCommit(ancestorSha, descendantSha) {
  if (!SHA_PATTERN.test(ancestorSha || '') || !SHA_PATTERN.test(descendantSha || '')) throw new Error('ancestor check requires lowercase 40-character commit ids');
  if (ancestorSha === descendantSha) return true;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(result.stderr.trim() || `git could not resolve ancestry ${ancestorSha}..${descendantSha}`);
}

// P1351 forbids a delayed attested release from overwriting a newer main revision. Requiring main to still equal the
// tested SHA also skipped runs whose only newer commits were data-refresh bot commits, and nothing re-drove the Worker
// plane afterwards: the live proxy stayed on an old revision while every Pages release check failed on the drift.
// A newer main is ignorable only when it descends from the tested SHA and no commit in between touches this plane's
// deployment inputs, so the tested Worker bytes equal main's. Anything unknown fails closed to the old skip.
// The deploy recipe is not a Worker input, but a newer main that edits it (wrangler pin, render step, rollback logic, this
// classifier) must not be treated as "data only": the recipe would run from main's workflow with the tested bytes.
export const WORKER_DEPLOY_RECIPE_FILES = [
  '.github/workflows/deploy-ai-proxy.yml',
  '.github/workflows/deploy-data-plane.yml',
  'scripts/worker-deploy-impact.mjs',
  'scripts/resolve-worker-rollback-version.mjs'
];

export function classifyMainAdvance(changedPaths) {
  const normalized = changedPaths.map((file) => file.replaceAll('\\', '/').replace(/^\.\//, ''));
  if (normalized.some((file) => WORKER_DEPLOY_RECIPE_FILES.includes(file))) return { dataPlane: true, aiProxy: true };
  return classifyWorkerDeployChanges(normalized);
}

export function getMainAdvanceWorkerChanges(testedSha, latestMainSha, listPaths = getChangedPathsBetween) {
  if (!SHA_PATTERN.test(testedSha || '') || !SHA_PATTERN.test(latestMainSha || '') || testedSha === latestMainSha) return undefined;
  try { return classifyMainAdvance(listPaths(testedSha, latestMainSha)); } catch { return undefined; }
}

export function shouldDeployWorker({ plane, manual = false, attestedChanged = false, liveSha, testedSha, latestMainSha, cumulativeChanges, newerMainChanges, isAncestor = isAncestorCommit }) {
  if (!SHA_PATTERN.test(testedSha || '')) throw new Error('tested SHA must be a lowercase 40-character commit id');
  if (!['dataPlane', 'aiProxy'].includes(plane)) throw new Error('deployment plane must be dataPlane or aiProxy');
  if (!SHA_PATTERN.test(latestMainSha || '')) throw new Error('latest main SHA is unavailable; automatic deployment is blocked');
  if (latestMainSha !== testedSha) {
    let advanceLeavesWorkerUntouched = false;
    try { advanceLeavesWorkerUntouched = newerMainChanges?.[plane] === false && isAncestor(testedSha, latestMainSha); } catch { advanceLeavesWorkerUntouched = false; }
    if (!advanceLeavesWorkerUntouched) return false;
  }
  // P1351: an explicit redeploy still cannot overwrite a newer main revision.
  if (manual) {
    if (latestMainSha === testedSha) return true;
    // Data-only advance: the live Worker may already be ahead of the tested SHA; never move its source label backwards.
    try { return SHA_PATTERN.test(liveSha || '') && (liveSha === testedSha || !isAncestor(testedSha, liveSha)); } catch { return false; }
  }
  if (liveSha === testedSha) return false;
  if (!SHA_PATTERN.test(liveSha || '')) throw new Error('live Worker source SHA is unavailable; cannot resolve deployment convergence');
  if (!isAncestor(liveSha, testedSha)) {
    if (isAncestor(testedSha, liveSha)) return false;
    throw new Error('live Worker SHA and tested main SHA diverge; automatic deployment is blocked');
  }
  if (attestedChanged) return true;
  return cumulativeChanges?.[plane] === true;
}

// --no-renames: rename detection folds a moved-and-edited file into one entry and can hide the source path (the same
// class as the P1497 staged-deletion fix), so a Worker input that moved away would look untouched.
export function getChangedPathsBetween(baseSha, headSha) {
  if (!SHA_PATTERN.test(headSha || '')) throw new Error('head SHA must be a lowercase 40-character commit id');
  if (baseSha === ZERO_SHA) {
    const tree = spawnSync('git', ['ls-tree', '-r', '--name-only', headSha], { cwd: root, encoding: 'utf8' });
    if (tree.status !== 0) throw new Error(tree.stderr.trim() || `git ls-tree failed for ${headSha}`);
    return tree.stdout.split(/\r?\n/).filter(Boolean);
  }
  if (!SHA_PATTERN.test(baseSha || '')) throw new Error('base SHA must be a lowercase 40-character commit id');
  if (!isAncestorCommit(baseSha, headSha)) throw new Error(`base SHA ${baseSha} is not an ancestor of tested SHA ${headSha}`);
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', baseSha, headSha], { cwd: root, encoding: 'utf8' });
  if (diff.status !== 0) throw new Error(diff.stderr.trim() || `git diff failed for ${baseSha}..${headSha}`);
  return diff.stdout.split(/\r?\n/).filter(Boolean);
}

export function getWorkerChangesBetween(baseSha, headSha) {
  return classifyWorkerDeployChanges(getChangedPathsBetween(baseSha, headSha));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--main-advance') {
      // Immediate pre-mutation guard: prints true when main still equals the tested SHA or advanced without touching the plane.
      const [, , , plane, testedSha, latestMainSha] = process.argv;
      if (!['dataPlane', 'aiProxy'].includes(plane) || !SHA_PATTERN.test(testedSha || '') || !SHA_PATTERN.test(latestMainSha || '')) throw new Error('usage: node scripts/worker-deploy-impact.mjs --main-advance <dataPlane|aiProxy> <tested-sha> <latest-main-sha>');
      const safe = testedSha === latestMainSha || getMainAdvanceWorkerChanges(testedSha, latestMainSha)?.[plane] === false;
      process.stdout.write(`${safe}\n`);
    } else {
      const [, , baseSha, headSha] = process.argv;
      if (!baseSha || !headSha) throw new Error('usage: node scripts/worker-deploy-impact.mjs <base-sha> <head-sha>');
      process.stdout.write(`${JSON.stringify(await getWorkerChangesBetween(baseSha, headSha))}\n`);
    }
  } catch (error) {
    console.error(`[worker-deploy-impact] ${error.message}`);
    process.exitCode = 1;
  }
}
