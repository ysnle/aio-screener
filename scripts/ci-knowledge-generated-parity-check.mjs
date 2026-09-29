import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
let candidateDirectory = null;
if (args.length) {
  if (args.length !== 2 || args[0] !== '--candidate-dir' || !args[1]) {
    throw new Error('Usage: node scripts/ci-knowledge-generated-parity-check.mjs [--candidate-dir <external-directory>]');
  }
  candidateDirectory = resolve(args[1]);
  const parent = dirname(candidateDirectory);
  if (!existsSync(parent) || !statSync(parent).isDirectory()) {
    throw new Error(`Knowledge candidate parent directory must already exist: ${parent}`);
  }
  if (existsSync(candidateDirectory)) {
    throw new Error(`Knowledge candidate directory must be new and empty of pre-existing paths: ${candidateDirectory}`);
  }
  const canonicalRoot = realpathSync(root);
  const canonicalCandidate = resolve(realpathSync(parent), relative(parent, candidateDirectory));
  const relativeCandidate = relative(canonicalRoot, canonicalCandidate);
  const candidateIsInsideWorkspace = relativeCandidate === '' || (!isAbsolute(relativeCandidate) && relativeCandidate !== '..' && !relativeCandidate.startsWith(`..${sep}`));
  if (candidateIsInsideWorkspace) {
    throw new Error('Knowledge candidate directory must resolve outside the repository workspace.');
  }
}

function gitHeadSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  const sha = String(result.stdout || '').trim();
  if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error('Knowledge candidate mode requires a Git checkout with a full HEAD SHA.');
  }
  return sha;
}

function candidateIdentity() {
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (status.status !== 0 || String(status.stdout || '').trim()) {
    throw new Error('Knowledge candidate mode requires a clean checkout so the manifest SHA identifies the exact source.');
  }
  const checkoutSha = gitHeadSha();
  const declaredSourceSha = process.env.AIO_SOURCE_SHA || checkoutSha;
  if (!/^[0-9a-f]{40}$/.test(declaredSourceSha) || declaredSourceSha !== checkoutSha) {
    throw new Error(`AIO_SOURCE_SHA must equal the checked-out HEAD SHA (${checkoutSha}).`);
  }
  const pullRequestHeadSha = process.env.AIO_PR_HEAD_SHA || null;
  if (pullRequestHeadSha && !/^[0-9a-f]{40}$/.test(pullRequestHeadSha)) {
    throw new Error('AIO_PR_HEAD_SHA must be a full 40-character lowercase commit SHA when provided.');
  }
  return { checkoutSha, pullRequestHeadSha };
}

function writeCandidateArtifact({ changed, before, after, isolatedRoot, identity }) {
  mkdirSync(candidateDirectory);
  const changedFiles = changed.map((path) => {
    const beforeSha256 = before.get(path) || null;
    const candidateSha256 = after.get(path) || null;
    const candidatePath = join(isolatedRoot, path);
    let bytes = null;
    let candidateArtifactSha256 = null;
    if (candidateSha256) {
      const outputPath = join(candidateDirectory, path);
      mkdirSync(dirname(outputPath), { recursive: true });
      copyFileSync(candidatePath, outputPath);
      bytes = statSync(outputPath).size;
      candidateArtifactSha256 = createHash('sha256').update(readFileSync(outputPath)).digest('hex');
    }
    return {
      path,
      change: candidateSha256 === null ? 'deleted' : beforeSha256 === null ? 'added' : 'updated',
      beforeSnapshotSha256: beforeSha256,
      candidateSnapshotSha256: candidateSha256,
      candidateArtifactSha256,
      bytes
    };
  });
  const manifest = {
    schemaVersion: 'aio-knowledge-build-candidate.v1',
    status: changedFiles.length ? 'READY_FOR_HUMAN_REVIEW' : 'NO_GENERATED_CHANGES',
    testedCheckoutSha: identity.checkoutSha,
    pullRequestHeadSha: identity.pullRequestHeadSha,
    builderCount: builders.length,
    snapshotHashNormalization: 'Snapshot SHA-256 values normalize CRLF to LF; candidateArtifactSha256 hashes the exact exported bytes.',
    changedFiles,
    humanReviewRequired: true,
    releaseArtifact: false,
    canonicalWorkspaceModified: false,
    note: 'Generated in a disposable workspace from the tested checkout. These files are review candidates only; this workflow does not update canonical sources or publish a release.'
  };
  writeFileSync(join(candidateDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Knowledge build candidate written outside the repository: ${candidateDirectory}`);
  console.log(`Candidate status: ${manifest.status}; ${changedFiles.length} generated target(s); tested SHA ${identity.checkoutSha}.`);
}

const builders = [
  // Each source producer must precede its generated-artifact consumers.
  ['scripts/build-principles-lessons.mjs'],
  ['scripts/build-nathan-framework-knowledge.mjs'],
  ['scripts/build-knowledge-concept-manifest.mjs'],
  ['scripts/build-principles-edge-semantics.mjs'],
  ['scripts/build-knowledge-evidence-registry.mjs'],
  ['scripts/enrich-knowledge-source-lessons.mjs'],
  ['scripts/build-integrated-market-ai-framework-knowledge.mjs'],
  ['scripts/build-knowledge-articles-and-learning-graph.mjs'],
  ['scripts/audit-knowledge-encyclopedia-depth.mjs'],
  ['scripts/build-knowledge-route-targets.mjs'],
  ['scripts/build-ai-knowledge-retrieval-index.mjs'],
  ['scripts/build-knowledge-coverage-matrix.mjs'],
  ['scripts/build-knowledge-research-dossiers.mjs'],
  ['scripts/build-knowledge-domain-dossiers.mjs'],
  ['scripts/build-knowledge-runtime-index.mjs'],
  ['scripts/build-atlas-current-evidence-ledger.mjs'],
  ['scripts/build-13f-issuer-aggregates.mjs']
];
const targets = [
  'public-data/knowledge/integrated-market-ai-frameworks.json',
  'public-data/knowledge/concepts.json',
  'public-data/knowledge/nathan-frameworks.json',
  'public-data/knowledge/aliases.json',
  'src/domain/knowledge/principles-edge-semantics.js',
  'public-data/knowledge/sources.json',
  'public-data/knowledge/claims.json',
  'public-data/principles/lesson-library.json',
  'public-data/atlas/foundation-lessons.json',
  'public-data/knowledge/articles.json',
  'public-data/knowledge/ai-retrieval-index.json',
  'public-data/knowledge/learning-graph.json',
  'public-data/knowledge/articles',
  'public-data/knowledge/route-targets.json',
  'public-data/knowledge/coverage-matrix.json',
  'public-data/knowledge/domain-dossiers.json',
  'public-data/knowledge/domain-dossiers',
  'public-data/knowledge/research-dossiers.json',
  'public-data/knowledge/research-dossiers',
  'public-data/knowledge/status-summary.json',
  'public-data/atlas/current-evidence-ledger.json',
  'public-data/atlas/index.json',
  'public-data/masters/issuer-aggregates.json',
  'public-data/masters/index.json'
];

const atomicWriterSource = readFileSync(join(root, 'scripts/lib/atomic-write.mjs'), 'utf8');
if (!/renameWithRetrySync/.test(atomicWriterSource) || !/RETRYABLE_RENAME_CODES/.test(atomicWriterSource) || !/EPERM/.test(atomicWriterSource)) {
  console.error('Knowledge generated parity failed: the shared atomic writer must preserve bounded Windows rename-lock retry handling.');
  process.exit(1);
}

for (const [script] of builders) {
  const source = readFileSync(join(root, script), 'utf8');
  if (/\bfs\.writeFileSync\s*\(|\bfs\.writeFile\s*\(/.test(source)) {
    console.error(`Knowledge generated parity failed: ${script} writes a published target directly instead of using the atomic writer.`);
    process.exit(1);
  }
}

const ignoredDirectories = new Set(['.git', '.cache', '.claude', '.codex', 'node_modules']);
const isIgnoredCopyDirectory = (basename) => ignoredDirectories.has(basename) || basename.startsWith('_codex-qa-cache-');

function assertSymlinkFreeTree(baseRoot, { lstatImpl = lstatSync, readdirImpl = readdirSync } = {}) {
  const pending = [baseRoot];
  while (pending.length) {
    const current = pending.pop();
    const currentStat = lstatImpl(current);
    if (currentStat.isSymbolicLink()) {
      throw new Error(`Knowledge generated parity refuses symlinks in builder workspaces: ${relative(baseRoot, current) || '.'}`);
    }
    if (!currentStat.isDirectory()) continue;
    for (const entry of readdirImpl(current, { withFileTypes: true })) {
      if (isIgnoredCopyDirectory(entry.name)) continue;
      const child = join(current, entry.name);
      const childStat = lstatImpl(child);
      if (childStat.isSymbolicLink()) {
        throw new Error(`Knowledge generated parity refuses symlinks in builder workspaces: ${relative(baseRoot, child)}`);
      }
      if (childStat.isDirectory()) pending.push(child);
    }
  }
}

function symlinkGuardFixturePasses() {
  const fixtureRoot = 'fixture-root';
  const key = (path) => String(path).replaceAll('\\', '/');
  const runFixture = (nodes, children) => assertSymlinkFreeTree(fixtureRoot, {
    lstatImpl(path) {
      const node = nodes.get(key(path));
      if (!node) throw new Error(`unexpected fixture path: ${key(path)}`);
      return {
        isSymbolicLink: () => node.kind === 'symlink',
        isDirectory: () => node.kind === 'directory'
      };
    },
    readdirImpl(path) {
      return children.get(key(path)) || [];
    }
  });
  const root = key(fixtureRoot);
  const publicData = key(join(fixtureRoot, 'public-data'));
  const safeNodes = new Map([
    [root, { kind: 'directory' }],
    [publicData, { kind: 'directory' }],
    [key(join(publicData, 'input.json')), { kind: 'file' }]
  ]);
  const safeChildren = new Map([
    [root, [{ name: 'public-data' }]],
    [publicData, [{ name: 'input.json' }]]
  ]);
  let safeTreeAccepted = true;
  try { runFixture(safeNodes, safeChildren); } catch (_) { safeTreeAccepted = false; }

  const unsafeNodes = new Map([
    [root, { kind: 'directory' }],
    [publicData, { kind: 'directory' }],
    [key(join(publicData, 'articles')), { kind: 'symlink' }]
  ]);
  const unsafeChildren = new Map([
    [root, [{ name: 'public-data' }]],
    [publicData, [{ name: 'articles' }]]
  ]);
  let unsafeTreeRejected = false;
  try { runFixture(unsafeNodes, unsafeChildren); } catch (error) {
    unsafeTreeRejected = /refuses symlinks/.test(String(error?.message || ''));
  }
  return safeTreeAccepted && unsafeTreeRejected;
}

const check = (label, ok) => {
  if (!ok) throw new Error(`Knowledge generated parity failed: ${label}`);
};
check('P1314/R660/QA-DATA-54 accepts an ordinary tree and rejects a linked generated-output directory', symlinkGuardFixturePasses());

function filesUnder(baseRoot, path) {
  const absolute = join(baseRoot, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => filesUnder(baseRoot, relative(baseRoot, join(absolute, entry.name))));
}

// P1168: the producers write LF. A Windows checkout materializes the same committed JSON as CRLF,
// so hashing raw bytes reported "builders changed generated outputs" and listed 21 content-identical
// files — a platform artifact that reads as a producer regression. Parity is a content property, so
// the comparison normalizes line endings instead of depending on the caller's checkout convention.
const normalizeNewlines = (buffer) => buffer.toString('utf8').replace(/\r\n/g, '\n');

function snapshot(baseRoot) {
  const rows = new Map();
  for (const file of [...new Set(targets.flatMap((target) => filesUnder(baseRoot, target)))].sort()) {
    rows.set(relative(baseRoot, file).replaceAll('\\', '/'), createHash('sha256').update(normalizeNewlines(readFileSync(file))).digest('hex'));
  }
  return rows;
}

// Producers resolve their workspace from their own script location and write through the shared
// atomic writer, so merely changing cwd cannot isolate them. Run every producer in a disposable
// workspace copy instead. This keeps parallel QA invocations from racing on published artifacts
// (and turns this check into a read-only operation against the caller's workspace).
assertSymlinkFreeTree(root);
const before = snapshot(root);
const identity = candidateDirectory ? candidateIdentity() : null;
const isolatedRoot = mkdtempSync(join(tmpdir(), 'aio-knowledge-parity-'));
const copyFilter = (source) => {
  const basename = source.slice(Math.max(source.lastIndexOf('\\'), source.lastIndexOf('/')) + 1);
  return !isIgnoredCopyDirectory(basename);
};
try {
  cpSync(root, isolatedRoot, { recursive: true, filter: copyFilter });
  // cpSync preserves symlinks by default. Verify the disposable copy before any builder
  // runs, so a PR-controlled generated target cannot redirect writes outside that copy.
  assertSymlinkFreeTree(isolatedRoot);
  for (const [script, ...args] of builders) {
    const result = spawnSync(process.execPath, [join(isolatedRoot, script), ...args], { cwd: isolatedRoot, encoding: 'utf8', stdio: 'pipe' });
    if (result.status !== 0) {
      console.error(`Knowledge generated parity failed while running ${script}:`);
      console.error(String(result.stderr || result.stdout || 'unknown builder failure').trim());
      throw new Error(`knowledge producer failed: ${script}`);
    }
  }
  const after = snapshot(isolatedRoot);
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changed = paths.filter((path) => before.get(path) !== after.get(path));
  if (candidateDirectory) {
    writeCandidateArtifact({ changed, before, after, isolatedRoot, identity });
  } else if (changed.length) {
    console.error('Knowledge generated parity failed: builders changed generated outputs. Review the regenerated files, then rerun.');
    changed.slice(0, 50).forEach((path) => console.error(` - ${path}`));
    if (changed.length > 50) console.error(` - ... ${changed.length - 50} more`);
    throw new Error('knowledge generated outputs drifted');
  } else {
    console.log(`Knowledge generated parity OK: ${builders.length} builders, ${after.size} generated files unchanged.`);
  }
} finally {
  rmSync(isolatedRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
