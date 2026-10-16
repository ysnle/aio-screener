// Artifact integrity only. Does not certify the policies or the product.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const errors = [];
const warnings = [];
const files = fs.readdirSync(dir);
for (const file of files.filter(f => /\.(md|json|mjs)$/.test(f))) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  if (text.includes('\r\n')) errors.push('Non-LF audit file: ' + file);
  if (file.endsWith('.json')) { try { JSON.parse(text); } catch { errors.push('Invalid JSON: ' + file); } }
  if (file.endsWith('.md')) for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z]+:\/\//i.test(target)) continue;
    const resolved = path.isAbsolute(target) ? target : path.resolve(dir, target);
    if (resolved === path.join(dir, 'validation.json')) continue; // This run creates its own receipt below.
    if (!fs.existsSync(resolved.replace(/:\d+$/, ''))) errors.push(`${file}: missing local link ${target}`);
  }
}
const readJson = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const delta = readJson('rule-delta.json');
const bookmark = readJson('bookmark-evidence-summary.json');
const coverage = readJson('coverage.json');
if (delta.entries.length !== coverage.latestChangedRuleBlocksRead) errors.push('Rule delta scope changed');
if (Object.values(bookmark.stateCounts).reduce((a,b) => a+b, 0) !== bookmark.actualItemCount || bookmark.actualItemCount !== bookmark.uniqueItemIds) errors.push('Bookmark inventory mismatch');
if (Object.values(bookmark.checkCounts).reduce((a,b) => a+b, 0) !== bookmark.claimCount) errors.push('Bookmark claim mismatch');
const c = readJson('counterexamples.json');
for (const row of c.sourceHashes) {
  const currentHash = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(dir, '../..', row.file))).digest('hex');
  if (currentHash !== row.sha256) warnings.push('Counterexample source changed; receipt remains historical: ' + row.file);
}
if (c.publication[0].outputWithoutEvidence || !c.publication[1].outputWithoutEvidence || !c.publication[2].outputWithoutEvidence) errors.push('Publication counterexample outcome changed; reassess report');
if (c.conduct[1].classification.status !== 'BLOCKED_P0' || c.conduct[2].classification.status !== 'EDUCATIONAL_ALLOWED') errors.push('Conduct outcome changed; reassess report');
if (c.skillFixtureDeletion.gateExit !== 0) errors.push('Fixture negative control changed; reassess report');
const drift = readJson('source-drift.json');
if (drift.changedSinceSnapshot.length) warnings.push('Source changed: ' + drift.changedSinceSnapshot.join(', '));
const result = { checkedAt: new Date().toISOString(), boundary: 'Audit-file integrity and receipt consistency only, not semantic truth or product certification', errors, warnings, markdownFiles: files.filter(f => f.endsWith('.md')).length, jsonFiles: files.filter(f => f.endsWith('.json')).length };
fs.writeFileSync(path.join(dir, 'validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
