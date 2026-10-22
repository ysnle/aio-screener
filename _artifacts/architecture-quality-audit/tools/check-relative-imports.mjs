import fs from 'node:fs';
import path from 'node:path';
import { SourceTextModule } from 'node:vm';
import crypto from 'node:crypto';
const root = fs.realpathSync(process.cwd());
const base = path.join(root, '_artifacts/architecture-quality-audit');
const repairsFile = path.join(base, 'relative-import-repairs.json');
const repairs = fs.existsSync(repairsFile) ? JSON.parse(fs.readFileSync(repairsFile, 'utf8')).repairs : [];
const issues = [], relative = [];
const walk = p => fs.readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(p, e.name)) : [path.join(p, e.name)]);
const inputs = [];
for (const absolute of walk(base).filter(p => p.endsWith('.mjs'))) {
  const row = { relocatedPath: path.relative(root, absolute).replaceAll('\\', '/') };
  const file = path.join(root, row.relocatedPath), source = fs.readFileSync(file, 'utf8');
  inputs.push({ path: row.relocatedPath, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
  const module = new SourceTextModule(source, { identifier: file });
  for (const specifier of module.dependencySpecifiers.filter(s => s.startsWith('.'))) {
    const resolved = path.resolve(path.dirname(file), specifier);
    const item = { file: row.relocatedPath, specifier, exists: fs.existsSync(resolved) };
    relative.push(item); if (!item.exists) issues.push(item);
  }
  for (const match of source.matchAll(/new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)) {
    const item = { file: row.relocatedPath, specifier: match[1], kind: 'import.meta.url', exists: fs.existsSync(new URL(match[1], 'file:///' + file.replaceAll('\\', '/'))) };
    relative.push(item); if (!item.exists) issues.push(item);
  }
}
const historicallyMissing = issues.filter(i => repairs.some(r => r.file === i.file && r.relocatedSpecifier === i.specifier && r.existsAtMigration === false));
const introducedMissing = issues.filter(i => !historicallyMissing.includes(i));
const report = { observedAt: new Date().toISOString(), inputs, references: relative.length, introducedMissing, historicallyMissing };
fs.writeFileSync(path.join(base, 'relative-import-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, inputs: inputs.length }, null, 2));
if (introducedMissing.length) process.exitCode = 1;
