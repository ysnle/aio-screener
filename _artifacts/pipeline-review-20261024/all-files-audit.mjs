// Audit evidence only. Never executes repository producers or changes source/data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const out = path.join(root, '_artifacts/pipeline-review-20261024');
const suffix = process.argv[2] ? '-' + process.argv[2].replace(/[^a-zA-Z0-9_-]/g, '') : '';
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
const paths = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort();
const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const counts = {};
const rows = [];
const edges = [];
const jsonFailures = [];
const classify = p => p.startsWith('public-data/') ? 'published-data' : p.startsWith('schemas/') ? 'schema' : p.startsWith('src/') || p.startsWith('js/') || p === 'index.html' || p === 'sw.js' ? 'browser' : p.startsWith('worker/') || p === 'cloudflare-worker-proxy.js' ? 'worker' : p.startsWith('scripts/ci-') || p.startsWith('scripts/qa-') ? 'verification' : p.startsWith('scripts/') ? 'producer-tooling' : p.startsWith('.github/') ? 'workflow' : p.startsWith('_artifacts/') ? 'audit-evidence' : /^(?:_context|\.agents|\.claude|\.codex|architecture|content)\//.test(p) ? 'governance-content-contract' : p.startsWith('_archive/') ? 'archive' : 'root-other';
for (const p of paths) {
  const absolute = path.join(root, p);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) { rows.push({ path: p, state: 'missing-or-nonfile' }); continue; }
  const bytes = fs.readFileSync(absolute);
  const family = classify(p);
  counts[family] = (counts[family] || 0) + 1;
  const text = /\.(?:m?js|cjs|json|md|html|css|yml|yaml|toml|txt|py|ps1|cmd|svg|xml|csv|tsv|rst|adoc)$/i.test(p) || /(?:^|\/)_(?:headers|redirects)$/.test(p);
  const row = { path: p, family, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), machineInspection: text ? 'text-scanned' : 'binary-inventory-only', semanticReview: 'NOT_CERTIFIED_BY_THIS_SCRIPT' };
  if (text) {
    const s = bytes.toString('utf8'); row.lines = s.split('\n').length;
    if (p.endsWith('.json')) {
      try { const obj = JSON.parse(s.replace(/^\uFEFF/, '')); row.json = { valid: true, kind: Array.isArray(obj) ? 'array' : typeof obj, schemaVersion: obj?.schemaVersion ?? null }; }
      catch (e) { row.json = { valid: false, error: e.message }; jsonFailures.push({ path: p, error: e.message }); }
    }
    if (/\.(?:m?js|cjs|html|yml|yaml|json|md|toml|py|ps1|cmd)$/.test(p) && !p.startsWith('_artifacts/')) {
      const patterns = [
        ['module', /(?:from\s*|import\s*\(|import\s+|require\s*\()(['"])(\.{1,2}\/[^'"\n]+)\1/g],
        ['artifact-reference', /(['"`])((?:\.\/)?public-data\/[^'"`\s${}]+)\1/g],
        ['script-command', /\b(?:node|python3?|pwsh)\s+((?:\.\/)?scripts\/[a-zA-Z0-9_.\/-]+)/g]
      ];
      for (const [kind, regex] of patterns) for (const match of s.matchAll(regex)) {
        const target = kind === 'script-command' ? match[1] : match[2];
        const resolved = kind === 'module' ? path.posix.normalize(path.posix.join(path.posix.dirname(p), target)) : target.replace(/^\.\//, '');
        edges.push({ from: p, line: s.slice(0, match.index).split('\n').length, kind, target, resolved, exists: fs.existsSync(path.join(root, resolved.split('?')[0])) });
      }
    }
  }
  rows.push(row);
}
const ignoredGroups = {};
for (const p of ignored) { const group = p.split('/')[0]; ignoredGroups[group] = (ignoredGroups[group] || 0) + 1; }
const report = { generatedAt: new Date().toISOString(), head: git(['rev-parse', 'HEAD']).trim(), version: JSON.parse(fs.readFileSync('version.json', 'utf8')).version, scope: 'all git tracked plus nonignored untracked files; ignored paths separately inventoried; .git internal objects excluded', limits: 'Text scanning and JSON syntax are not semantic review. Regex edges are candidates, not a complete dependency graph; dynamic paths require direct tracing. Ignored files are pathname inventory only; no private content copied.', files: rows.length, counts, jsonFailures, edges: edges.length, unresolvedEdgeCandidates: edges.filter(e => !e.exists).length, ignoredFiles: ignored.length, ignoredGroups };
fs.writeFileSync(path.join(out, `ALL-FILES-INVENTORY${suffix}.json`), JSON.stringify({ report, files: rows }, null, 2) + '\n');
fs.writeFileSync(path.join(out, `PIPELINE-EDGE-CANDIDATES${suffix}.json`), JSON.stringify(edges, null, 2) + '\n');
fs.writeFileSync(path.join(out, `IGNORED-PATHS${suffix}.json`), JSON.stringify({ limits: report.limits, paths: ignored }, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
