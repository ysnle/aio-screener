import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SourceTextModule } from 'node:vm';
import { spawnSync, execFileSync } from 'node:child_process';
const root = fs.realpathSync(process.cwd());
const base = path.join(root, '_artifacts/architecture-quality-audit');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const load = name => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
const original = load('original-files.json'), migration = load('migration.json');
const failures = [], links = [], syntax = [], json = [];
const check = (value, message) => { if (!value) failures.push(message); };
const walk = p => fs.readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(p, e.name)) : [path.join(p, e.name)]);
check(sha(fs.readFileSync(path.join(base, 'originals.zip'))) === original.archiveSha256, 'Original archive digest');
check(original.entries.length === 482 && migration.entries.length === 482, '482 originals/relocations');
check(new Set(migration.entries.map(r => r.relocatedPath)).size === 482, 'Unique relocation destinations');
const originalByPath = new Map(original.entries.map(r => [r.originalPath, r]));
check(originalByPath.size === 482 && new Set(migration.entries.map(r => r.originalPath)).size === 482, 'Unique original identities');
check(migration.originalArchiveSha256 === original.archiveSha256, 'Migration archive identity');
check(migration.entries.every(r => {
  const old = originalByPath.get(r.originalPath);
  return old && ['originalPath', 'relocatedPath', 'archiveEntry', 'bytes', 'sha256'].every(key => old[key] === r[key]);
}), 'Original and migration entries bind one-to-one');
let raw = 0;
for (const row of migration.entries) {
  const target = path.resolve(root, row.relocatedPath);
  check(target.startsWith(base + path.sep), `Outside destination: ${target}`);
  check(fs.existsSync(target), `Missing relocated file: ${target}`);
  const digest = sha(fs.readFileSync(target));
  check(digest === row.relocatedSha256, `Post-migration digest mismatch: ${row.relocatedPath}`);
  if (!/\.(md|mjs)$/.test(target)) { raw++; check(digest === row.sha256, `Raw evidence changed: ${row.relocatedPath}`); }
}
for (const item of original.sourceDirectories) check(!fs.existsSync(path.join(root, '_artifacts', item.old)), `Old top-level directory remains: ${item.old}`);
for (const file of walk(base)) {
  if (file.endsWith('.mjs')) {
    try { new SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file }); syntax.push({ file, status: 'PASS' }); }
    catch (e) { failures.push(`Syntax ${file}: ${e.message}`); }
  }
  if (file.endsWith('.json')) {
    try { JSON.parse(fs.readFileSync(file, 'utf8')); json.push(file); }
    catch (e) { failures.push(`JSON ${file}: ${e.message}`); }
  }
  if (file.endsWith('.md')) for (const m of fs.readFileSync(file, 'utf8').matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\n]+)\)/g)) {
    const href = m[1].replace(/^<|>$/g, '');
    if (/^(?:https?:|codex:|mailto:|#)/i.test(href)) continue;
    const target = path.resolve(path.dirname(file), href.split('#')[0]);
    links.push({ file, href }); check(fs.existsSync(target), `Missing link: ${file} -> ${href}`);
  }
}
const baseline = load('evidence/20261021-v5859/reading-ledger.json'), canonical = load('reading-ledger.json'), coverage = load('coverage.json');
check(canonical.length === 850 && new Set(canonical.map(r => r.path)).size === 850, 'Canonical source ledger 850 unique');
const continuationFile = path.join(base, 'reviews/remaining-20261022/continuation.json');
const continuation = fs.existsSync(continuationFile) ? JSON.parse(fs.readFileSync(continuationFile, 'utf8')) : null;
const additions = new Map((continuation?.receipts || []).map(r => [r.path, r]));
check(additions.size === (continuation?.receipts.length || 0), 'Unique continuation receipts');
if (continuation) check(continuation.fixedRef === '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc', 'Pinned continuation ref');
const relocateEvidence = value => {
  if (typeof value !== 'string') return value;
  for (const { from, to } of load('path-map.json').prefixMappings) if (value === from || value.startsWith(from + '/')) return to + value.slice(from.length);
  return value;
};
check(canonical.every((r, i) => {
  const receipt = additions.get(r.path), old = baseline[i];
  const immutable = row => { const { status, reason, evidence, ...rest } = row; return rest; };
  if (JSON.stringify(immutable(r)) !== JSON.stringify(immutable(old))) return false;
  if (!receipt) return r.status === old.status && r.reason === old.reason && r.evidence === relocateEvidence(old.evidence);
  if (!/^_artifacts\/architecture-quality-audit\/reviews\/remaining-20261022\/(?:screener|security|legacy|shell)-reading\.tsv$/.test(receipt.readingReceipt)) return false;
  const table = fs.readFileSync(path.resolve(root, receipt.readingReceipt), 'utf8').trimEnd().split(/\r?\n/);
  const keys = table.shift().split('\t');
  const entry = table.map(line => Object.fromEntries(line.split('\t').map((v, n) => [keys[n], v]))).find(e => e.path === r.path && ['FULL', 'FULL_DIRECT'].includes(e.status) && e.ref === continuation.fixedRef);
  const fixed = execFileSync('git', ['show', `${continuation.fixedRef}:${r.path}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  const range = `1-${fixed.toString('utf8').split('\n').length}`;
  return sha(fixed) === old.sha256 && receipt.range === range && entry?.read_ranges === range && r.status === 'FULL_CURRENT_REVIEW' && receipt.priorStatus === old.status && receipt.sha256 === old.sha256 && entry?.sha256 === old.sha256 && r.reason === entry.reason && r.evidence === receipt.readingReceipt;
}), 'Canonical claims must equal history or a matching full continuation receipt');
const full = canonical.filter(r => r.status.includes('FULL')).length;
const netFull = (continuation?.receipts || []).filter(r => !r.priorStatus.includes('FULL')).length;
const unfinished = canonical.filter(r => /REQUIRED|NOT_SEMANTICALLY|PARTIAL|DRIFT|DIFF_ONLY|REUSED_PRIOR_STATIC_REVIEW/.test(r.status)).map(r => r.path);
check(full === 405 + netFull && JSON.stringify(coverage.unfinished) === JSON.stringify(unfinished) && unfinished.length === 432 - netFull && canonical.filter(r => r.status === 'REUSED_CANONICAL_MIRROR').length === 13, 'Historical coverage plus evidenced net additions');
const expectedCounts = Object.fromEntries([...new Set(canonical.map(r => r.status))].map(s => [s, canonical.filter(r => r.status === s).length]));
check(JSON.stringify(coverage.counts) === JSON.stringify(expectedCounts), 'Coverage counts match canonical rows');
if (continuation) check(continuation.current.full === full && continuation.current.unfinished === unfinished.length && continuation.current.mirrors === 13 && continuation.newlyFull.length === netFull, 'Continuation totals match actual ledger');
const main = fs.readFileSync(path.join(base, 'HANDOFF.md'), 'utf8');
check((main.match(/^\| A\d\d /gm) || []).length === 27, '27 main groups preserved');
check(fs.readFileSync(path.join(base, 'evidence/20261018/TOOLING.md'), 'utf8').includes('60개 대상 중25개 전문 검토·35개 미독'), '60/25/35 wording corrected');
const beforeGuard = migration.entries.map(r => sha(fs.readFileSync(path.join(root, r.relocatedPath))));
const guardMarkerExists = fs.existsSync(path.join(base, 'relative-import-repairs.json'));
check(guardMarkerExists, 'Repair marker required before testing repeat guard; never repair during verification');
const guard = guardMarkerExists
  ? spawnSync(process.execPath, ['--experimental-vm-modules', path.join(base, 'tools/repair-relative-imports.mjs')], { encoding: 'utf8' })
  : { status: null, stderr: 'Guard test skipped: repair marker missing' };
check(guard.status !== 0 && guard.stderr.includes('already applied'), 'Repeated repair must refuse before writes');
check(migration.entries.every((r, i) => beforeGuard[i] === sha(fs.readFileSync(path.join(root, r.relocatedPath)))), 'Repeated repair changed evidence');
const reviewed = new Map();
function add(reader, date, names) { for (const name of names.split(',')) { const key = `${date}/${name}.md`; reviewed.set(key, [...(reviewed.get(key) || []), reader]); } }
add('consolidation_details', '20261018', 'FOUNDATIONS,DOMAIN,DATA-AI,UI,TOOLING,TOOLING-CI-1');
add('consolidation_details', '20261019', 'UI-PAGES,MACRO-MARKET');
add('consolidation_details', '20261021', 'FINANCIAL-DELTA,INTERPRETATION,PRODUCERS,LEGACY-DATA-CONTINUED,LEGACY-CORE,UI-DELTA');
add('consolidation_details', '20261021-v5859', 'LEGACY-CORE,DOMAIN-DELTA,domain-complete,tooling-review,ROOT-FOLLOWUP,UI-DELTA,OFFICIAL-CROSSCHECK,audit-ledger-review');
add('consolidation_claims', '20261021-v5859', 'HANDOFF,DECISION-QUALITY,BROWSER,VALIDATION,REMAINING-CHAT,REMAINING-GOVERNANCE,REMAINING-QA-RUNNER,REMAINING-UI,REMAINING-WORKFLOWS,REMAINING-WORKSPACE-TOOLS,LATEST-DELTA-v5860,audit-ledger-review');
add('consolidation_claims', '20261018', 'HANDOFF'); add('consolidation_claims', '20261021', 'HANDOFF');
add('consolidation_claims', '20261019', 'FINANCIAL,MACRO-MARKET,UI-PAGES,UI-PAGES-CONTINUED,BOUNDARIES,LEGACY-DATA');
add('root', '20261018', 'REPRODUCED');
const docRows = original.entries.filter(r => r.originalPath.endsWith('.md')).map(r => {
  const key = r.relocatedPath.split('/evidence/')[1], readers = reviewed.get(key) || [];
  check(readers.length > 0, `No reported full-document reader: ${key}`);
  return { originalPath: r.originalPath, currentPath: r.relocatedPath, originalSha256: r.sha256, readers, status: 'FULL_DOCUMENT_REVIEW_REPORTED', boundary: 'Whole audit document read; not a new FULL reading of its product source, every external reference or every proof script.' };
});
const related = [
  'codex-reform-audit-20261015/HANDOFF.md', 'codex-reform-audit-20261015/REVIEW.md', 'codex-reform-audit-20261015/CLOSEOUT.md',
  'internal-quality-review-20261016/HANDOFF.md', 'policy-criteria-review-20261016/HANDOFF.md',
  'exhaustive-quality-audit-20261016/HANDOFF.md', 'exhaustive-quality-audit-20261016/LATEST-STATUS-v57.98.md',
  'exhaustive-quality-audit-20261016/REVIEW-CORRECTIONS.md', 'exhaustive-quality-audit-20261016/CLOSEOUT.md'
];
const session = JSON.parse(fs.readFileSync(path.join(root, '.cache/aio-qa/sessions/audit-consolidation-20261022.json'), 'utf8'));
for (const relative of related) {
  const p = '_artifacts/' + relative, digest = sha(fs.readFileSync(path.join(root, p)));
  check(session.files[p] === digest, `Related handoff changed after session baseline: ${p}`);
  docRows.push({ originalPath: p, currentPath: p, originalSha256: digest, readers: ['consolidation_history'], status: 'FULL_DOCUMENT_REVIEW_REPORTED' });
}
fs.writeFileSync(path.join(base, 'documentation-review.json'), JSON.stringify({ observedAt: new Date().toISOString(), architectureMarkdown: docRows.length - related.length, relatedMarkdown: related.length, independence: 'limited: same model, separate contexts; reader reports plus source/receipt checks, not a second full reading of all product code.', documents: docRows }, null, 2) + '\n');
const imports = load('relative-import-check.json'); check(imports.introducedMissing.length === 0, 'Introduced unresolved relative imports');
const importInputs = new Map((imports.inputs || []).map(r => [r.path, r.sha256]));
check(walk(base).filter(p => p.endsWith('.mjs')).every(p => importInputs.get(path.relative(root, p).replaceAll('\\', '/')) === sha(fs.readFileSync(p))), 'Relative import report covers current helper bytes; run check-relative-imports first');
const report = { observedAt: new Date().toISOString(), status: failures.length ? 'FAIL' : 'PASS_WITH_BOUNDARY', originalFiles: migration.entries.length, rawEvidenceUnchanged: raw,
  markdownReviewed: docRows.length, syntaxFiles: syntax.length, parsedJson: json.length, checkedMarkdownLinks: links.length,
  coverage: { full, canonicalMirrors: 13, unfinished: coverage.unfinished.length },
  relativeImports: imports, repeatRepairGuard: { attempted: guardMarkerExists, rejected: guard.status != null && guard.status !== 0, evidenceBytesUnchanged: migration.entries.every((r, i) => beforeGuard[i] === sha(fs.readFileSync(path.join(root, r.relocatedPath)))) }, failures,
  boundary: 'Consolidation preservation and continuation ledger integrity; reported document/source readings are distinct from product/live/browser/producer certification. This verifier regenerates documentation-review.json and verification.json.' };
fs.writeFileSync(path.join(base, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
