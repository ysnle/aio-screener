import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SourceTextModule } from 'node:vm';
const root = fs.realpathSync(process.cwd());
const dir = path.join(root, '_artifacts/architecture-quality-audit');
const reportPath = path.join(dir, 'migration.json');
if (fs.existsSync(path.join(dir, 'relative-import-repairs.json'))) throw new Error('Relative-import migration was already applied; preserve its manifest instead of applying it twice');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const mappings = JSON.parse(fs.readFileSync(path.join(dir, 'path-map.json'), 'utf8')).prefixMappings;
const repairs = [];
const slash = p => p.replaceAll('\\', '/');
for (const row of report.entries.filter(r => r.relocatedPath.endsWith('.mjs'))) {
  const file = path.join(root, row.relocatedPath);
  let source = fs.readFileSync(file, 'utf8');
  const module = new SourceTextModule(source, { identifier: file });
  const relative = [...module.dependencySpecifiers.filter(s => s.startsWith('.')),
    ...[...source.matchAll(/new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)].map(m => m[1])];
  for (const specifier of [...new Set(relative)]) {
    const oldTarget = path.resolve(path.dirname(path.join(root, row.originalPath)), specifier);
    let targetRepo = slash(path.relative(root, oldTarget));
    const mapping = mappings.find(m => targetRepo === m.from || targetRepo.startsWith(m.from + '/'));
    if (mapping) targetRepo = mapping.to + targetRepo.slice(mapping.from.length);
    const target = path.resolve(root, targetRepo);
    let replacement = slash(path.relative(path.dirname(file), target));
    if (!replacement.startsWith('.')) replacement = './' + replacement;
    if (replacement === specifier) continue;
    for (const quote of ["'", '"']) source = source.replaceAll(quote + specifier + quote, quote + replacement + quote);
    repairs.push({ file: row.relocatedPath, originalSpecifier: specifier, relocatedSpecifier: replacement, target: targetRepo, existsAtMigration: fs.existsSync(target) });
  }
  if (repairs.some(r => r.file === row.relocatedPath)) {
    fs.writeFileSync(file, source);
    row.relocatedSha256 = crypto.createHash('sha256').update(source).digest('hex');
    row.bytesAfter = Buffer.byteLength(source);
    row.transformation += '; RELATIVE_IMPORT_BASE_RELOCATED';
  }
}
report.changed = report.entries.filter(r => r.sha256 !== r.relocatedSha256).length;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'relative-import-repairs.json'), JSON.stringify({ boundary: 'Only restore the original target of relative module/file-URL literals after directory relocation. Missing retired targets remain explicit, never replaced with a stub.', repairs }, null, 2) + '\n');
console.log(JSON.stringify({ repairs: repairs.length, historicallyMissing: repairs.filter(r => !r.existsAtMigration) }, null, 2));
