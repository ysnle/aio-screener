import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const dir = '_artifacts/architecture-quality-audit/evidence/20261021-v5859';
const paths = [
  'scripts/ci-knowledge-learning-state-contract.mjs', 'scripts/ci-knowledge-full-corpus-coverage.mjs',
  'scripts/ci-knowledge-currentness-separation.mjs', 'scripts/ci-knowledge-current-observations-check.mjs',
  'scripts/ci-knowledge-review-check.mjs', 'scripts/ci-knowledge-article-contract.mjs',
  'scripts/ci-knowledge-article-uniqueness.mjs', 'scripts/ci-knowledge-core-semantic-check.mjs',
  'scripts/ci-knowledge-ontology-contract.mjs', 'scripts/ci-knowledge-web-research-dossier.mjs',
  'scripts/ci-knowledge-route-bridge-contract.mjs', 'scripts/ci-knowledge-renderer-contract.mjs',
  'scripts/ci-knowledge-market-transmission.mjs', 'scripts/ci-knowledge-sector-domain-depth.mjs',
  'scripts/lib/knowledge-authoring-contract.mjs', 'scripts/ci-knowledge-generated-parity-check.mjs',
  'scripts/ci-human-validation-contract-check.mjs', 'scripts/ci-semantic-review-check.mjs',
  'scripts/ci-operator-readiness-check.mjs', 'scripts/ci-operations-slo-window-check.mjs',
  'scripts/ci-operations-alert-policy-check.mjs', 'scripts/ci-deployment-convergence-check.mjs',
  'scripts/ci-live-header-policy-contract-check.mjs', 'scripts/lib/operations-alert-policy.mjs',
  'scripts/lib/operational-health.mjs', 'scripts/ci-reconciliation-contract-check.mjs'
];
const rows = paths.map(p => {
  const b = execFileSync('git', ['show', `${ref}:${p}`], { maxBuffer: 32 * 1024 * 1024 });
  return [p, ref, crypto.createHash('sha256').update(b).digest('hex'), b.length, `bytes:[0,${b.length})`, 'FULL',
    'Root read the entire pinned source; truncated review-check tail repaired. Knowledge/operational oracle and policy semantics inspected; only the three named gates executed in isolated VM. No producer/parity builder execution.'];
});
fs.writeFileSync(`${dir}/remaining-root-reading.tsv`, 'path\tref\tsha256\tbytes\tread_ranges\tstatus\treason\n' + rows.map(r => r.join('\t')).join('\n') + '\n');
console.log(JSON.stringify({ files: rows.length, bytes: rows.reduce((n, r) => n + r[3], 0), ref }));
