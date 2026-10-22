// Derive the current audit ledger from immutable history plus explicit reading receipts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const dir = '_artifacts/architecture-quality-audit';
const lane = `${dir}/reviews/remaining-20261022`;
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const load = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const mappings = load(`${dir}/path-map.json`).prefixMappings;
const relocate = value => {
  if (typeof value !== 'string') return value;
  for (const { from, to } of mappings) if (value.startsWith(from + '/') || value === from) return to + value.slice(from.length);
  return value;
};
const baseline = load(`${dir}/evidence/20261021-v5859/reading-ledger.json`).map(r => ({ ...r, evidence: relocate(r.evidence) }));
const rows = baseline.map(r => ({ ...r })), receipts = [], ignored = [];
for (const name of ['screener', 'security', 'legacy', 'shell']) {
  const file = `${lane}/${name}-reading.tsv`;
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trimEnd().split(/\r?\n/);
  const headers = head.split('\t');
  for (const line of lines) {
    const cells = line.split('\t'), receipt = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    if (receipt.ref !== ref || !['FULL', 'FULL_DIRECT'].includes(receipt.status)) { ignored.push({ file, ...receipt }); continue; }
    const row = rows.find(r => r.path === receipt.path);
    if (!row || row.sha256 !== receipt.sha256) throw Error(`Inventory receipt mismatch: ${receipt.path}`);
    const fixed = execFileSync('git', ['show', `${ref}:${receipt.path}`], { maxBuffer: 4 * 1024 * 1024 });
    if (sha(fixed) !== receipt.sha256 || receipt.read_ranges !== `1-${fixed.toString('utf8').split('\n').length}`) throw Error(`Incomplete or wrong blob: ${receipt.path}`);
    if (receipts.some(r => r.path === row.path)) throw Error('Duplicate full receipt: ' + row.path);
    receipts.push({ path: row.path, sha256: row.sha256, priorStatus: row.status, readingReceipt: file, reader: name, range: receipt.read_ranges });
    row.status = 'FULL_CURRENT_REVIEW'; row.reason = receipt.reason; row.evidence = file;
  }
}
const oldCoverage = load(`${dir}/evidence/20261021-v5859/coverage.json`);
const workingTreeDrift = rows.filter(r => !fs.existsSync(r.path) || sha(fs.readFileSync(r.path)) !== r.sha256).map(r => r.path);
const counts = Object.fromEntries([...new Set(rows.map(r => r.status))].map(s => [s, rows.filter(r => r.status === s).length]));
const unfinished = rows.filter(r => /REQUIRED|NOT_SEMANTICALLY|PARTIAL|DRIFT|DIFF_ONLY|REUSED_PRIOR_STATIC_REVIEW/.test(r.status)).map(r => r.path);
const full = rows.filter(r => r.status.includes('FULL')).length;
const continuation = { observedAt: new Date().toISOString(), fixedRef: ref, receipts, ignoredPartialOrWorktreeReceipts: ignored,
  baseline: { full: 405, mirrors: 13, unfinished: 432 }, current: { full, mirrors: rows.filter(r => r.status === 'REUSED_CANONICAL_MIRROR').length, unfinished: unfinished.length },
  newlyFull: receipts.filter(r => !r.priorStatus.includes('FULL')).map(r => r.path),
  boundary: 'Receipts assert actual whole-source reading. SHA and continuous declared range are checked; dependency copies/probes/partial callers do not become FULL. Fixed source ledger is distinct from current diff and live evidence.' };
const coverage = { ...oldCoverage, observedAt: continuation.observedAt, counts, worktreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeDrift, unfinished,
  continuation: { path: `${lane}/continuation.json`, fullReadReceipts: receipts.length, newlyFull: continuation.newlyFull.length },
  boundary: 'v58.59 fixed source inventory; immutable historical receipts plus 2026-10-22 continuation. Current drift remains separate and not certified by a fixed-blob FULL.' };
fs.writeFileSync(`${lane}/continuation.json`, JSON.stringify(continuation, null, 2) + '\n');
fs.writeFileSync(`${dir}/reading-ledger.json`, JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(`${dir}/reading-ledger.tsv`, 'path\tstatus\tsha256\treason\tevidence\n' + rows.map(r => [r.path, r.status, r.sha256, r.reason, r.evidence || ''].map(v => String(v).replace(/[\t\r\n]/g, ' ')).join('\t')).join('\n') + '\n');
fs.writeFileSync(`${dir}/coverage.json`, JSON.stringify(coverage, null, 2) + '\n');
console.log(JSON.stringify({ receipts: receipts.length, newlyFull: continuation.newlyFull.length, ...continuation.current, counts }));
