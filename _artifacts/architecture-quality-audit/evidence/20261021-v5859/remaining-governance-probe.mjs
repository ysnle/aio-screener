import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const out = '_artifacts/architecture-quality-audit/evidence/20261021-v5859';
const blob = p => execFileSync('git', ['show', `${ref}:${p}`], { maxBuffer: 32 * 1024 * 1024 });
const json = p => JSON.parse(blob(p));
const hash = p => crypto.createHash('sha256').update(blob(p)).digest('hex');
function run(file, overrides = {}) {
  const logs = [];
  let exitCode = null, thrown = null;
  const read = input => {
    const p = (input instanceof URL ? input.pathname : String(input)).replaceAll('\\', '/').replace(/^.*?\/repo\//, '').replace(/^\.\//, '');
    return Object.hasOwn(overrides, p) ? JSON.stringify(overrides[p]) : blob(p).toString('utf8');
  };
  const source = blob(file).toString('utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', '"file:///repo/scripts/gate.mjs"');
  const context = { fs: { readFileSync: read }, readFileSync: read, path: path.posix, fileURLToPath: u => new URL(u).pathname, URL,
    console: { log: s => logs.push(String(s)), error: s => logs.push(String(s)) },
    process: { exit: n => { exitCode = n; throw new Error(`EXIT:${n}`); } } };
  try { vm.runInNewContext(source, context, { timeout: 10000, filename: file }); } catch (e) { thrown = e.message; }
  return { requestedProcessExitCode: exitCode, evaluationCompleted: thrown === null, thrown, logs: logs.map(s => { try { return JSON.parse(s); } catch { return s; } }) };
}
const unique = 'scripts/ci-knowledge-article-uniqueness.mjs';
const articles = json('public-data/knowledge/articles.json');
articles.articles[1].deepArticle.uniqueDraftSeed = structuredClone(articles.articles[0].deepArticle.uniqueDraftSeed);
const dossiersFile = 'scripts/ci-knowledge-web-research-dossier.mjs';
const dossiers = json('public-data/knowledge/research-dossiers.json');
const omittedUnit = dossiers.dossiers[1].contentUnitId;
dossiers.dossiers[1].contentUnitId = dossiers.dossiers[0].contentUnitId;
const operator = 'scripts/ci-operator-readiness-check.mjs';
const closed = json('public-data/reconciliation-status.json');
closed.categories.forEach(c => { c.status = 'MATCH'; });
closed.overall = 'MATCH';
closed.counts = { MATCH: closed.categories.length };
closed.closure = { ...closed.closure, complete: true, unresolvedCategories: [] };
const result = { ref, evidence: 'Actual pinned gate bodies in VM; pinned read-only artifacts; in-memory mutations only; no producers, external I/O or product writes.',
  sourceHashes: Object.fromEntries([unique, dossiersFile, operator].map(p => [p, hash(p)])),
  uniqueness: { baseline: run(unique), duplicateSeed: run(unique, { 'public-data/knowledge/articles.json': articles }) },
  dossierCoverage: { omittedUnit, uniqueContentUnits: new Set(dossiers.dossiers.map(d => d.contentUnitId)).size, rows: dossiers.dossiers.length,
    baseline: run(dossiersFile), duplicateUnit: run(dossiersFile, { 'public-data/knowledge/research-dossiers.json': dossiers }) },
  readiness: { baseline: run(operator), allReconciled: run(operator, { 'public-data/reconciliation-status.json': closed }),
    scope: 'Top-level closure and category states are changed consistently for the gate under review. This is a gate-condition probe, not certification of the detailed evidence in each category or the whole pipeline.' }
};
fs.writeFileSync(`${out}/remaining-governance-probe.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
