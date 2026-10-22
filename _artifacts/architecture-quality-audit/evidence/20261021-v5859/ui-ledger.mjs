import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const base = 'd36bb256';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const digest = (content) => createHash('sha256').update(content).digest('hex');
const previous = readFileSync('_artifacts/architecture-quality-audit/evidence/20261021/ui-delta-reading.tsv', 'utf8').trim().split(/\r?\n/).slice(1).map((line) => line.split('\t'));
const older = readFileSync('_artifacts/architecture-quality-audit/evidence/20261019/ui-pages-reading.tsv', 'utf8').trim().split(/\r?\n/).slice(1).map((line) => line.split('\t'));
const paths = git('ls-tree', '-r', '--name-only', ref, 'src/ui/pages', 'src/ui/knowledge').trim().split('\n');
const full = ['src/ui/components/fundamental-analysis-cards.js', 'src/ui/components/fundamental-analysis-lazy.js', 'src/ui/components/screener-validation.js', 'src/ui/components/portfolio-read.js'];
paths.push(...full);
const output = ['path\tstatus\tbaseSha256\tsha256\treason'];
for (const path of paths) {
  const current = git('show', `${ref}:${path}`);
  let before = null;
  try { before = git('show', `${base}:${path}`); } catch { /* new at REF */ }
  const hash = digest(current);
  const baseHash = before == null ? '' : digest(before);
  const old = previous.find((r) => r[0] === path);
  if (old && old[3] !== baseHash) throw Error(`prior ledger mismatch: ${path}`);
  if (old?.[1] === 'FULL' && old[2]) {
    const ancestor = older.find((r) => r[0] === path);
    if (!ancestor || ancestor[1] !== 'FULL' || ancestor[2] !== old[2]) throw Error(`FULL ancestry mismatch: ${path}`);
  }
  const status = full.includes(path) ? 'FULL' : hash === baseHash ? 'INHERITED_FULL' : 'BASE_PLUS_DIFF';
  const reason = status === 'FULL' ? '고정 REF 전문 신규 읽기; 기존 파일인 portfolio-read/screener-validation도 이번에 전문 재검토'
    : status === 'INHERITED_FULL' ? '이전 FULL/FULL_DIFF_REVIEW 원장과 base/current SHA-256 동일; 이번 전수 재독으로 세지 않음'
      : '이전 FULL 기반 + d36bb256..REF 전체 diff 의미 검토; 전체 현재 파일 재독으로 세지 않음';
  output.push([path, status, baseHash, hash, reason].join('\t'));
}
writeFileSync(new URL('./ui-reading.tsv', import.meta.url), output.join('\n') + '\n');
console.log(JSON.stringify({ ref, paths: paths.length, statuses: Object.fromEntries(['FULL', 'INHERITED_FULL', 'BASE_PLUS_DIFF'].map((s) => [s, output.filter((l) => l.split('\t')[1] === s).length])), ledgerAncestry: 'all applicable previous hashes matched actual d36bb256 blobs; prior FULL hashes matched 20261019 ledger' }, null, 2));
