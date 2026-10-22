import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = fs.realpathSync(process.cwd());
const dir = path.resolve(root, '_artifacts/architecture-quality-audit');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'original-files.json'), 'utf8'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const slash = p => p.replaceAll('\\', '/');
const prefixMap = manifest.sourceDirectories.map(r => ({ from: `_artifacts/${r.old}`, to: `_artifacts/architecture-quality-audit/evidence/${r.id}` })).sort((a, b) => b.from.length - a.from.length);
function remapRepoPath(p) {
  const key = slash(p);
  const found = prefixMap.find(r => key === r.from || key.startsWith(r.from + '/'));
  return found ? found.to + key.slice(found.from.length) : key;
}
function checkOwned(p) {
  const resolved = path.resolve(root, p);
  if (!resolved.startsWith(dir + path.sep)) throw new Error(`Outside audit destination: ${resolved}`);
  return resolved;
}
const changed = [], missingLinks = [];
for (const row of manifest.entries) {
  const file = checkOwned(row.relocatedPath);
  const bytes = fs.readFileSync(file);
  if (hash(bytes) !== row.sha256) throw new Error(`Unexpected post-move modification: ${row.relocatedPath}`);
  let text = bytes.toString('utf8');
  let kind = 'UNCHANGED_ORIGINAL_BYTES';
  if (file.endsWith('.md')) {
    const oldDir = path.dirname(path.resolve(root, row.originalPath));
    text = text.replace(/(!?\[[^\]]*\]\()(<[^>]+>|[^)\n]+)(\))/g, (all, before, body, after) => {
      const wrapped = body.startsWith('<') && body.endsWith('>');
      const href = wrapped ? body.slice(1, -1) : body;
      if (/^(?:https?:|mailto:|codex:|#)/i.test(href)) return all;
      const [filePart, ...anchor] = href.split('#');
      const absolute = path.resolve(oldDir, filePart);
      const repoPath = slash(path.relative(root, absolute));
      const target = path.resolve(root, remapRepoPath(repoPath));
      let relative = slash(path.relative(path.dirname(file), target));
      if (!relative.startsWith('.')) relative = './' + relative;
      const result = relative + (anchor.length ? '#' + anchor.join('#') : '');
      if (!fs.existsSync(target)) missingLinks.push({ file: row.relocatedPath, originalHref: href, relocatedHref: result });
      return before + (wrapped || /\s/.test(result) ? '<' + result + '>' : result) + after;
    });
    const banner = '> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.\n\n';
    text = banner + text;
    kind = 'HISTORICAL_DOCUMENT_WITH_RELOCATED_LINKS_AND_BANNER';
  } else if (file.endsWith('.mjs')) {
    for (const pair of prefixMap) text = text.replaceAll(pair.from, pair.to);
    // A few historical helpers used platform-specific absolute audit-directory literals.
    for (const pair of prefixMap) {
      text = text.replaceAll(pair.from.replaceAll('/', '\\\\'), pair.to.replaceAll('/', '\\\\'));
    }
    kind = text === bytes.toString('utf8') ? kind : 'HELPER_AUDIT_PATH_LITERALS_RELOCATED';
  }
  if (kind !== 'UNCHANGED_ORIGINAL_BYTES') fs.writeFileSync(file, text.replaceAll('\r\n', '\n'));
  const after = fs.readFileSync(file);
  changed.push({ ...row, relocatedSha256: hash(after), transformation: kind, bytesAfter: after.length });
}
if (missingLinks.length) fs.writeFileSync(path.join(dir, 'preexisting-or-relocated-link-issues.json'), JSON.stringify(missingLinks, null, 2) + '\n');
const latest = path.join(dir, 'evidence/20261021-v5859');
const rows = JSON.parse(fs.readFileSync(path.join(latest, 'reading-ledger.json'), 'utf8'));
const derived = rows.map(r => ({ ...r, evidence: typeof r.evidence === 'string' ? remapRepoPath(r.evidence) : r.evidence }));
fs.writeFileSync(path.join(dir, 'reading-ledger.json'), JSON.stringify(derived, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'reading-ledger.tsv'), 'path\tstatus\tsha256\treason\tevidence\n' + derived.map(r => [r.path, r.status, r.sha256, r.reason, r.evidence || ''].map(v => String(v).replace(/[\t\r\n]/g, ' ')).join('\t')).join('\n') + '\n');
const coverage = JSON.parse(fs.readFileSync(path.join(latest, 'coverage.json'), 'utf8'));
fs.writeFileSync(path.join(dir, 'coverage.json'), JSON.stringify({ ...coverage, consolidation: { consolidatedAt: new Date().toISOString(), source: 'evidence/20261021-v5859/coverage.json', boundary: 'Counts belong to the pinned historical source inventory; consolidation does not add semantic coverage or certify the current product.' } }, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'path-map.json'), JSON.stringify({ prefixMappings: prefixMap, originals: 'original-files.json', rule: 'Replace a matched path prefix; preserve its remaining filename. Raw JSON/log/TSV evidence retains historical strings; canonical reading-ledger is a separately labelled derived view.' }, null, 2) + '\n');
const report = { consolidatedAt: new Date().toISOString(), originalArchiveSha256: manifest.archiveSha256, files: changed.length, rawPreservation: 'Every non-MD/MJS original file is unchanged; all 482 originals are independently recoverable byte-for-byte from originals.zip.', changed: changed.filter(r => r.sha256 !== r.relocatedSha256).length, entries: changed, missingLinks };
fs.writeFileSync(path.join(dir, 'migration.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ files: report.files, changed: report.changed, missingLinks }, null, 2));
