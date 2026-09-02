import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const dir = '_artifacts/exhaustive-audit-20260831';
const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const lines = text => text ? text.split('\n').length - Number(text.endsWith('\n')) : 0;
const classify = path => /\.(?:[cm]?js|jsx|tsx?|html?|css|scss|py|ps1|sh|bash|sql|ya?ml|toml)$/.test(path) ? 'code-config'
  : /\.json$/.test(path) ? 'data-contract' : /\.(?:md|txt)$/.test(path) ? 'documentation' : 'other';
const manifestPath = `${dir}/manifest.json`;
const command = process.argv[2] || 'status';

if (command === 'init') {
  if (fs.existsSync(manifestPath)) throw new Error('Baseline exists; never overwrite review scope.');
  const files = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))]
    .filter(path => fs.existsSync(path) && fs.statSync(path).isFile() && !path.startsWith(`${dir}/`))
    .map(path => { const bytes = fs.readFileSync(path); return { path, kind: classify(path), bytes: bytes.length, lines: lines(bytes.toString('utf8')), sha256: digest(bytes), semanticReview: 'pending' }; });
  const commits = [];
  const byCommit = new Map();
  let current;
  for (const line of git('log', '--all', '--reverse', '--topo-order', '-m', '--root', '--no-renames', '--raw', '--no-abbrev', '--format=@@@%H %P').split('\n')) {
    if (line.startsWith('@@@')) {
      const [sha, ...parents] = line.slice(3).trim().split(' ');
      current = byCommit.get(sha);
      if (!current) { current = { sha, parents, changes: [], semanticReview: 'pending' }; commits.push(current); byCommit.set(sha, current); }
    } else if (line.startsWith(':')) {
      const match = line.match(/^:(\d+) (\d+) ([a-f0-9]+) ([a-f0-9]+) (\w+)\t(.*)$/);
      if (!match || !current) throw new Error(`Unparsed history row: ${line.slice(0, 160)}`);
      const [, oldMode, newMode, before, after, status, path] = match;
      // Merge parents can repeat identical transitions. Keep the unique blob
      // transitions; the full parents array remains available for topology review.
      if (!current.changes.some(c => c.path === path && c.before === before && c.after === after)) current.changes.push({ path, kind: classify(path), oldMode, newMode, before, after, status, semanticReview: 'pending' });
    }
  }
  const manifest = { schemaVersion: 'exhaustive-review-scope.v1', capturedAt: new Date().toISOString(), head: git('rev-parse', 'HEAD').trim(), version: JSON.parse(fs.readFileSync('version.json', 'utf8')).version,
    scope: 'All tracked/nonignored current files and every commit reachable from local refs. Baseline audit artifacts are auxiliary records. No unavailable pre-Git history or remote-only refs claimed.',
    completionRule: 'Indexing, syntax checks and CI do not mark semantic review complete. Review entries require exact current SHA-256 or historical blob IDs and explicit ranges. Edits invalidate old current-file coverage.', files, commits };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const reviewsPath = `${dir}/reviews.jsonl`;
const reviews = fs.existsSync(reviewsPath) ? fs.readFileSync(reviewsPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const baselinePaths = new Set(manifest.files.map(file => file.path));
const additions = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))]
  .filter(path => !baselinePaths.has(path) && !path.startsWith(`${dir}/`) && fs.existsSync(path) && fs.statSync(path).isFile())
  .map(path => ({ path, kind: classify(path), lines: 0, sha256: null }));
const source = [...manifest.files, ...additions].filter(f => f.kind === 'code-config');
const covered = source.map(file => {
  const actualHash = fs.existsSync(file.path) ? digest(fs.readFileSync(file.path)) : null;
  const currentLines = actualHash ? lines(fs.readFileSync(file.path, 'utf8')) : 0;
  const ranges = reviews.filter(r => r.type === 'current-lines' && r.path === file.path && r.sha256 === actualHash).flatMap(r => r.ranges);
  if (ranges.some(([start, end]) => !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || start > end || end > currentLines)) throw new Error(`Invalid review range: ${file.path}`);
  const coveredLines = new Set(ranges.flatMap(([start, end]) => Array.from({ length: end - start + 1 }, (_, i) => start + i)));
  return { path: file.path, baselineLines: file.lines, currentLines, coveredLines: coveredLines.size, fullyReviewed: currentLines > 0 && coveredLines.size === currentLines, changedSinceBaseline: actualHash !== file.sha256 };
});
const transitionKey = row => `${row.commit}:${row.path}:${row.before}:${row.after}`;
const knownTransitions = new Set(manifest.commits.flatMap(commit => commit.changes.map(change => transitionKey({ commit: commit.sha, ...change }))));
const validHistory = reviews.filter(row => row.type === 'history-transition' && knownTransitions.has(transitionKey(row)));
const summary = { asOf: new Date().toISOString(), scopeHead: manifest.head, files: manifest.files.length, addedFiles: additions.length, codeConfigFiles: source.length, codeConfigBaselineLines: source.reduce((n,f)=>n+f.lines,0), codeConfigCurrentLines: covered.reduce((n,f)=>n+f.currentLines,0), commits: manifest.commits.length,
  historyTransitions: manifest.commits.reduce((n,c)=>n+c.changes.length,0), codeHistoryTransitions: manifest.commits.reduce((n,c)=>n+c.changes.filter(f=>f.kind==='code-config').length,0),
  currentSemanticallyReviewedLines: covered.reduce((n,f)=>n+f.coveredLines,0), currentFullyReviewedFiles: covered.filter(f=>f.fullyReviewed).length,
  historyReviewedTransitions: new Set(validHistory.map(transitionKey)).size, releaseCertified: false, filesWithReview: covered.filter(f=>f.coveredLines>0), remainingCodeFiles: covered.filter(f=>!f.fullyReviewed).map(f=>({ path:f.path, currentLines:f.currentLines, coveredLines:f.coveredLines })) };
fs.writeFileSync(`${dir}/coverage-summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, filesWithReview: undefined, remainingCodeFiles: undefined }, null, 2));
