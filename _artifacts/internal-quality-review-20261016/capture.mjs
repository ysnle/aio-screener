// Read-only repository inspection; outputs are confined to this audit directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const write = (p, v) => fs.writeFileSync(path.join(dir, p), typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n');
function files(base) {
  const location = path.join(root, base);
  if (!fs.existsSync(location)) return [];
  return fs.readdirSync(location, { withFileTypes: true }).flatMap(e => e.isDirectory() && base + '/' + e.name !== '.claude/worktrees' ? files(base + '/' + e.name) : e.isFile() ? [base + '/' + e.name] : []);
}
const paths = [...new Set([
  'AGENTS.md', 'CLAUDE.md', 'scripts/agent-hook.mjs',
  ...files('architecture').filter(p => p.endsWith('.json')),
  ...files('_context').filter(p => /\.(md|json)$/.test(p)),
  ...files('.claude').filter(p => /\.(md|json)$/.test(p) && !p.includes('/settings')),
  ...files('src/ai').filter(p => /policy|prompt|eval|planner/.test(p)),
  ...files('src/domain/rules')
])].filter(p => fs.existsSync(path.join(root, p))).sort();
const snapshotFile = path.join(dir, 'source-receipt.json');
if (!fs.existsSync(snapshotFile)) write('source-receipt.json', {
  capturedAt: new Date().toISOString(), version: JSON.parse(read('version.json')),
  warning: 'This is a discovery/hash inventory. Inclusion does not mean the content received semantic review. Existing dirty and concurrent edits are not owned by this audit.',
  files: paths.map(file => { const text = read(file); return { file, bytes: Buffer.byteLength(text), sha256: hash(text) }; }),
  rules: read('_context/RULES.md')
});
const snap = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
const separateCheckoutFiles = snap.files.filter(r => r.file.startsWith('.claude/worktrees/'));
if (separateCheckoutFiles.length) {
  snap.excludedSeparateCheckoutFiles = separateCheckoutFiles.length;
  snap.files = snap.files.filter(r => !r.file.startsWith('.claude/worktrees/'));
  write('source-receipt.json', snap);
}
const changed = snap.files.filter(r => !fs.existsSync(path.join(root, r.file)) || hash(read(r.file)) !== r.sha256).map(r => r.file);
function blocks(text) {
  const lines = text.split(/\r?\n/);
  const starts = lines.flatMap((text, i) => {
    const m = text.match(/^(?:#{2,4}\s+|\*\*)R(\d+)(-A)?(?=[.\s:—–-])/);
    return m ? [{ id: `R${m[1]}${m[2] || ''}`, line: i + 1, title: text, i }] : [];
  });
  return starts.map((s, n) => ({ ...s, text: lines.slice(s.i, starts[n + 1]?.i || lines.length).join('\n').trim() }));
}
const old = blocks(JSON.parse(read('_artifacts/policy-criteria-review-20261016/source-snapshot.json')).rules);
const current = blocks(snap.rules);
const delta = current.flatMap(b => {
  const previous = old.filter(o => o.id === b.id);
  if (previous.some(o => o.text === b.text)) return [];
  return [{ id: b.id, line: b.line, title: b.title, kind: previous.length ? 'changed' : 'added', currentText: b.text, previousText: previous.map(o => o.text) }];
});
write('rule-delta.json', { oldSnapshot: 'policy-criteria-review-20261016/source-snapshot.json', currentSnapshotAt: snap.capturedAt, entries: delta });
write('rule-delta.md', '# 1차 감사 후 R 원문 변경\n\n자동 차이 목록이며 의미 검토 완료 표가 아니다. 문서 배열/공백 이동도 차이로 잡힐 수 있다.\n\n' + delta.map(b => `## ${b.id} · ${b.kind} · 현재 ${b.line}행\n\n${b.currentText}\n`).join('\n'));
const ledger = JSON.parse(read('_artifacts/x-bookmarks-20261016/ledger.json'));
const items = ledger.items || [];
const group = values => Object.fromEntries([...new Set(values)].sort().map(k => [k, values.filter(x => x === k).length]));
const claims = items.flatMap(item => (item.claims || []).map(claim => ({ ...claim, itemId: item.id })));
const itemProperties = [...new Set(items.flatMap(Object.keys))].sort();
const claimProperties = [...new Set(claims.flatMap(Object.keys))].sort();
const statuses = group(items.map(x => x.repo?.state || 'absent'));
const checks = group(claims.map(c => c.check || 'absent'));
const referenceRows = items.filter(i => i.repo?.where).map(i => {
  const parts = String(i.repo.where).split(/[,;]/).map(s => s.trim());
  const parsed = parts.flatMap(s => { const m = s.match(/^([\w./-]+\.(?:js|mjs|json|md))(?:[:#].*)?$/); return m ? [m[1]] : []; });
  return { itemId: i.id, parsedPaths: parsed, shorthandPaths: parsed.filter(p => !p.includes('/')), missingPaths: parsed.filter(p => p.includes('/') && !fs.existsSync(path.join(root, p))) };
});
const summary = {
  sourceSha256: hash(read('_artifacts/x-bookmarks-20261016/ledger.json')),
  declaredCounts: ledger.counts, actualItemCount: items.length,
  uniqueItemIds: new Set(items.map(i => i.id)).size, stateCounts: statuses,
  claimCount: claims.length, checkCounts: checks, itemProperties, claimProperties,
  rootProperties: Object.keys(ledger),
  missingParsedRepoPaths: referenceRows.filter(r => r.missingPaths.length),
  verifiedExamples: claims.filter(c => c.check === 'VERIFIED').slice(0, 5),
  interpretation: 'Counts, labels, and paths only. VERIFIED/CONSISTENT are ledger labels, not verification by this audit. Unparsed prose paths are not treated as missing. No original bookmark/thread/article/image was re-fetched or visually inspected here.'
};
write('bookmark-evidence-summary.json', summary);
write('source-drift.json', { checkedAt: new Date().toISOString(), changedSinceSnapshot: changed });
console.log(JSON.stringify({ discovered: paths.length, changedSinceSnapshot: changed, changedRuleBlocks: delta.length, addedRuleIds: delta.filter(x => x.kind === 'added').map(x => x.id), bookmarkItems: items.length, statuses, claimCount: claims.length, checks, missingPaths: summary.missingParsedRepoPaths.length }, null, 2));
