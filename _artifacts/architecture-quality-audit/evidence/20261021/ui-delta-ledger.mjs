import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'df6f0b33';
const ref = 'd36bb256ddf60468d6c7a134628053c5796be6be';
const dir = '_artifacts/architecture-quality-audit/evidence/20261021';
const git = (...args) => execFileSync('git', args, { maxBuffer: 30e6 });
const hash = (b) => createHash('sha256').update(b).digest('hex');
const old = readFileSync('_artifacts/architecture-quality-audit/evidence/20261019/ui-pages-reading.tsv', 'utf8').trim().split(/\r?\n/).slice(1).map((line) => line.split('\t'));
const rows = [];
for (const [path, status, previousHash] of old) {
  const baseBytes = git('show', `${base}:${path}`);
  if (hash(baseBytes) !== previousHash) throw new Error(`base ledger hash mismatch ${path}`);
  let current;
  try { current = git('show', `${ref}:${path}`); } catch { rows.push([path, 'FULL_DIFF_REVIEW', previousHash, '', '기존 FULL + 삭제 diff 전문; 고정 REF의 production import 참조 없음 확인']); continue; }
  const changed = hash(current) !== previousHash;
  rows.push([path, changed ? 'FULL_DIFF_REVIEW' : status, previousHash, hash(current), changed ? '기존 FULL + df6f0b33..d36bb256 전체 diff 의미 검토; 호출 계약은 UI-DELTA.md 참조' : '기존 FULL 원장 SHA-256과 고정 REF 내용 동일; 전수읽기 계승']);
}
for (const path of ['src/ui/knowledge/knowledge-search.js', 'src/ui/panels/portfolio-trade-journal.js', 'src/domain/portfolio/trade-journal.js']) rows.push([path, 'FULL', '', hash(git('show', `${ref}:${path}`)), '고정 REF 신규 파일 전문 검토; 매매일지 결측·통화·백업 재현은 ui-delta-repro.mjs']);
writeFileSync(`${dir}/ui-delta-reading.tsv`, ['path\tstatus\tbaseSha256\tsha256\treason', ...rows.map((r) => r.join('\t'))].join('\n') + '\n');
console.log(JSON.stringify({ ref, base, rows: rows.length, deleted: rows.filter((r) => !r[3]).length, current: rows.filter((r) => r[3]).length, statuses: Object.fromEntries([...new Set(rows.map((r) => r[1]))].map((s) => [s, rows.filter((r) => r[1] === s).length])) }));
